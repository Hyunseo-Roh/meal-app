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
};

const COLS = 'id, name, source, created_at, category';

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
): Promise<PantryItem | null> {
  const v = name.trim().toLowerCase();
  if (!v) return null;
  const userId = await getCurrentUserId();

  const { data: existing, error: findErr } = await withTimeout(
    supabase.from('pantry_items').select(COLS).eq('user_id', userId).eq('name', v).maybeSingle(),
  );
  if (findErr) throw new Error('pantry_add_failed');
  if (existing) return existing as PantryItem;

  // created_at / updated_at are NOT NULL with no DB default — set both.
  const now = new Date().toISOString();
  const { data, error } = await withTimeout(
    supabase
      .from('pantry_items')
      .insert({ user_id: userId, name: v, source, created_at: now, updated_at: now })
      .select(COLS)
      .single(),
  );
  if (error || !data) throw new Error('pantry_add_failed');
  return data as PantryItem;
}

/** Delete one item by id, scoped to the current user (defensive even with RLS off). */
export async function deletePantryItem(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await withTimeout(
    supabase.from('pantry_items').delete().eq('id', id).eq('user_id', userId),
  );
  if (error) throw new Error('pantry_delete_failed');
}
