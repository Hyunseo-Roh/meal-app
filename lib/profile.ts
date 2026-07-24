import { getCurrentUserId, withTimeout } from './currentUser';
import { supabase } from './supabase';

/**
 * Taste-preference read/save for the Profile tab + its editor. Reads/writes the
 * same `users` columns onboarding does (constraints.tsx), so the two stay
 * consistent. Timeout-guarded, named errors, matching the other lib/ modules.
 * Does NOT touch recommend_meals / scoring / the gap RPC.
 */
export type BudgetLevel = 'low' | 'medium' | 'high';

export type TasteProfile = {
  favoriteCuisineIds: string[]; // chosen favorites (UNORDERED, max 3); pref_cuisine_ids. [0] mirrors pref_cuisine_id for the gate
  dislikedCuisineIds: string[]; // disliked_cuisine_ids
  dislikedIngredients: string[]; // disliked_ingredients
  effort: number | null; // pref_effort 1–3
  budget: BudgetLevel | null; // default_budget
};

// Display label maps — duplicated locally to keep this decoupled from onboarding.
const EFFORT_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Involved' };
const BUDGET_LABEL: Record<BudgetLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

// Ingredient names are stored lowercase; capitalize the first letter for display
// (same one-liner as gap.ts / recommend.ts). Cuisine labels already arrive cased.
function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Raw current values, for the editor to seed its local state. */
export async function loadTasteProfile(): Promise<TasteProfile> {
  const userId = await getCurrentUserId();
  const { data, error } = await withTimeout(
    supabase
      .from('users')
      .select(
        'pref_cuisine_id, pref_cuisine_ids, disliked_cuisine_ids, disliked_ingredients, pref_effort, default_budget',
      )
      .eq('id', userId)
      .single(),
  );
  if (error || !data) throw new Error('taste_load_failed');

  // Ranked favorites: prefer the ordered array (nulls filtered, capped to 3);
  // fall back to the legacy scalar so pre-migration single-favorite users load
  // as a 1-element list.
  const rankedIds = ((data.pref_cuisine_ids as (string | null)[] | null) ?? [])
    .filter((id): id is string => !!id)
    .slice(0, 3);
  const scalarId = (data.pref_cuisine_id as string | null) ?? null;
  const favoriteCuisineIds = rankedIds.length > 0 ? rankedIds : scalarId ? [scalarId] : [];

  return {
    favoriteCuisineIds,
    dislikedCuisineIds: (data.disliked_cuisine_ids as string[] | null) ?? [],
    dislikedIngredients: (data.disliked_ingredients as string[] | null) ?? [],
    effort: (data.pref_effort as number | null) ?? null,
    budget: (data.default_budget as BudgetLevel | null) ?? null,
  };
}

/** Display-ready summary for the Profile screen (resolves cuisine names; no rank). */
export async function loadTasteSummary(): Promise<{
  favoriteCuisines: string[];
  avoids: string[];
  effortLabel: string | null;
  budgetLabel: string | null;
}> {
  const p = await loadTasteProfile();

  // Resolve favorite cuisine ids → display labels in one query (avoids guessing
  // the users→cuisines FK-embed constraint name). Stored order preserved;
  // unresolved ids (e.g. a cuisine that no longer exists) drop out.
  const cuisineIds = p.favoriteCuisineIds;
  let labelById = new Map<string, string>();
  if (cuisineIds.length > 0) {
    const { data } = await withTimeout(
      supabase.from('cuisines').select('id, display_label').in('id', cuisineIds),
    );
    labelById = new Map(
      ((data as { id: string; display_label: string }[] | null) ?? []).map((c) => [
        c.id,
        c.display_label,
      ]),
    );
  }
  const resolve = (ids: string[]): string[] =>
    ids.map((id) => labelById.get(id)).filter((label): label is string => !!label);

  const favoriteCuisines = resolve(p.favoriteCuisineIds);

  // "Avoids" is the user's avoided INGREDIENTS — still collected at onboarding
  // and still enforced by recommend_meals. Disliked cuisines are no longer part
  // of it: that input was removed and the stored column cleared (migration
  // 20260723_clear_disliked_cuisines). Dietary is excluded (never persisted).
  const avoids = p.dislikedIngredients.map(capitalize);

  return {
    favoriteCuisines,
    avoids,
    effortLabel: p.effort != null ? (EFFORT_LABEL[p.effort] ?? null) : null,
    budgetLabel: p.budget ? (BUDGET_LABEL[p.budget] ?? null) : null,
  };
}

/**
 * Single users UPDATE. `disliked_cuisine_ids` is deprecated — its input was
 * removed from onboarding and this editor, and the stored values were cleared
 * (migration 20260723_clear_disliked_cuisines). It is intentionally OMITTED
 * from the payload (and dropped from the input type) because it is no longer a
 * user-facing preference — NOT to preserve any legacy value.
 */
export async function saveTasteProfile(
  p: Omit<TasteProfile, 'dislikedCuisineIds'>,
): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await withTimeout(
    supabase
      .from('users')
      .update({
        // Chosen favorites (unordered). The scalar mirrors any one of them so the
        // onboarding gate (currentUser.ts isOnboarded) stays non-null; the array
        // is what recommend_meals + reasons.ts read.
        pref_cuisine_ids: p.favoriteCuisineIds,
        pref_cuisine_id: p.favoriteCuisineIds[0] ?? null,
        disliked_ingredients: p.dislikedIngredients,
        pref_effort: p.effort,
        default_budget: p.budget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId),
  );
  if (error) throw new Error('taste_save_failed');
}
