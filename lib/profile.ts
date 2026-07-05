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
  favoriteCuisineId: string | null; // pref_cuisine_id
  dislikedCuisineIds: string[]; // disliked_cuisine_ids
  dislikedIngredients: string[]; // disliked_ingredients
  effort: number | null; // pref_effort 1–3
  budget: BudgetLevel | null; // default_budget
};

// Display label maps — duplicated locally to keep this decoupled from onboarding.
const EFFORT_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Involved' };
const BUDGET_LABEL: Record<BudgetLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** Raw current values, for the editor to seed its local state. */
export async function loadTasteProfile(): Promise<TasteProfile> {
  const userId = await getCurrentUserId();
  const { data, error } = await withTimeout(
    supabase
      .from('users')
      .select(
        'pref_cuisine_id, disliked_cuisine_ids, disliked_ingredients, pref_effort, default_budget',
      )
      .eq('id', userId)
      .single(),
  );
  if (error || !data) throw new Error('taste_load_failed');
  return {
    favoriteCuisineId: (data.pref_cuisine_id as string | null) ?? null,
    dislikedCuisineIds: (data.disliked_cuisine_ids as string[] | null) ?? [],
    dislikedIngredients: (data.disliked_ingredients as string[] | null) ?? [],
    effort: (data.pref_effort as number | null) ?? null,
    budget: (data.default_budget as BudgetLevel | null) ?? null,
  };
}

/** Display-ready summary for the Profile screen (resolves the cuisine name). */
export async function loadTasteSummary(): Promise<{
  favoriteCuisine: string | null;
  avoidsCount: number;
  effortLabel: string | null;
  budgetLabel: string | null;
}> {
  const p = await loadTasteProfile();

  // Resolve the favorite cuisine's display name (second small query — avoids
  // guessing the users→cuisines FK-embed constraint name).
  let favoriteCuisine: string | null = null;
  if (p.favoriteCuisineId) {
    const { data } = await withTimeout(
      supabase.from('cuisines').select('display_label').eq('id', p.favoriteCuisineId).single(),
    );
    favoriteCuisine = (data?.display_label as string | undefined) ?? null;
  }

  return {
    favoriteCuisine,
    avoidsCount: p.dislikedCuisineIds.length + p.dislikedIngredients.length,
    effortLabel: p.effort != null ? (EFFORT_LABEL[p.effort] ?? null) : null,
    budgetLabel: p.budget ? (BUDGET_LABEL[p.budget] ?? null) : null,
  };
}

/** Single users UPDATE — exact same columns as onboarding's constraints.tsx save. */
export async function saveTasteProfile(p: TasteProfile): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await withTimeout(
    supabase
      .from('users')
      .update({
        pref_cuisine_id: p.favoriteCuisineId,
        disliked_cuisine_ids: p.dislikedCuisineIds,
        disliked_ingredients: p.dislikedIngredients,
        pref_effort: p.effort,
        default_budget: p.budget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId),
  );
  if (error) throw new Error('taste_save_failed');
}
