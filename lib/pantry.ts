import { getCurrentUserId, withTimeout } from './currentUser';
import { supabase } from './supabase';

/**
 * Pantry CRUD for the current user (Pantry tab). Direct pantry_items access —
 * does NOT touch the get_ingredient_gap / recommend_meals RPCs (those read this
 * data server-side at query time). Every call is timeout-guarded and throws a
 * named error on failure, matching lib/feedback.ts / lib/currentUser.ts.
 */
export type PantryItem = {
  id: string;
  name: string;
  source: string;
  created_at: string;
  // Stored category override (nullable). NULL → client categorize() fallback.
  category: string | null;
  // On-hand count (DB default 1). Display/edit only — the recommendation engine
  // matches on ingredient PRESENCE, never on quantity.
  quantity: number;
};

const COLS = 'id, name, source, created_at, category, quantity';

/** The current user's items, newest first. */
export async function listPantry(): Promise<PantryItem[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await withTimeout(
    supabase
      .from('pantry_items')
      .select(COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
  if (error) throw new Error('pantry_list_failed');
  return (data ?? []) as PantryItem[];
}

/**
 * Add one item. Names are trimmed + lowercased; empty is ignored (returns null).
 * There's no DB unique constraint on (user_id, name), so we dedupe client-side:
 * if the name already exists, return that row rather than inserting a duplicate.
 * Otherwise insert and return the new row. `source` records origin — 'manual'
 * (default, typed/quick-add) or 'scanned' (barcode); both are the existing
 * app-convention values for the text column (no new schema).
 */
export async function addPantryItem(
  name: string,
  source: 'manual' | 'scanned' = 'manual',
  category: string | null = null,
): Promise<PantryItem | null> {
  const v = name.trim().toLowerCase();
  if (!v) return null;
  const userId = await getCurrentUserId();

  const { data: existing, error: findErr } = await withTimeout(
    supabase.from('pantry_items').select(COLS).eq('user_id', userId).eq('name', v).maybeSingle(),
  );
  if (findErr) throw new Error('pantry_add_failed');
  if (existing) return existing as PantryItem;

  // created_at / updated_at are NOT NULL with no DB default — set both. `category`
  // is written explicitly when a category is selected (so the new item lands in
  // the current view); omitted otherwise so the render-time heuristic applies.
  // quantity is left to the DB default (1).
  const now = new Date().toISOString();
  const insert: Record<string, unknown> = {
    user_id: userId,
    name: v,
    source,
    created_at: now,
    updated_at: now,
  };
  if (category) insert.category = category;
  const { data, error } = await withTimeout(
    supabase.from('pantry_items').insert(insert).select(COLS).single(),
  );
  if (error || !data) throw new Error('pantry_add_failed');
  return data as PantryItem;
}

/**
 * Move one item to another category (P3) — writes the category column directly.
 * RLS is disabled (anon GRANT), so this succeeds; the dormant UPDATE policy needs
 * no change. Callers pass only labels from CATEGORY_ORDER. Throws on failure.
 */
export async function setPantryItemCategory(id: string, category: string): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('pantry_items').update({ category }).eq('id', id),
  );
  if (error) throw new Error('pantry_move_failed');
}

/**
 * Set an item's on-hand quantity (the stepper on the Pantry list). Display/edit
 * only — the recommendation engine never reads quantity, so this can't shift any
 * pick. Callers clamp to >= 1 before calling. Throws on failure.
 */
export async function setPantryItemQuantity(id: string, quantity: number): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from('pantry_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', id),
  );
  if (error) throw new Error('pantry_quantity_failed');
}

/** Delete one item by id, scoped to the current user (defensive even with RLS off). */
export async function deletePantryItem(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await withTimeout(
    supabase.from('pantry_items').delete().eq('id', id).eq('user_id', userId),
  );
  if (error) throw new Error('pantry_delete_failed');
}
