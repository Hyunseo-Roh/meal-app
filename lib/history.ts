import { getCurrentUserId, withTimeout } from './currentUser';
import { supabase } from './supabase';

/**
 * "Made meals" history for the History tab. Read-only — reuses the existing
 * `recommendation_options.was_selected = true` marker that confirm/[id].tsx
 * already writes when a user taps "Make this". No history table, no new write.
 *
 * The row links to the meal (meal_id) and, via request_id, to the request that
 * carries user_id + created_at. recommendation_options itself has no timestamp,
 * so we sort client-side by the request's created_at (a single user's set is
 * small). Does NOT touch recommend_meals / get_ingredient_gap / scoring.
 */
export type HistoryEntry = {
  mealId: string;
  name: string;
  cuisineLabel: string;
  createdAt: string; // ISO, from recommendation_requests.created_at
};

export async function loadHistory(): Promise<HistoryEntry[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await withTimeout(
    supabase
      .from('recommendation_options')
      .select(
        'meal_id, recommendation_requests!inner(created_at, user_id), meals(name, cuisines!fk_meals_cuisine(display_label))',
      )
      .eq('was_selected', true)
      .eq('recommendation_requests.user_id', userId),
  );
  if (error || !data) throw new Error('history_load_failed');

  const entries: HistoryEntry[] = (data as Record<string, unknown>[]).map((row) => {
    // FK embeds come back as object-or-array — normalize both (same shape guard
    // as gap.ts). request is inner-joined (always present); meal may be absent.
    const reqEmbed = row.recommendation_requests as unknown;
    const req = (Array.isArray(reqEmbed) ? reqEmbed[0] : reqEmbed) as
      | { created_at: string }
      | null
      | undefined;

    const mealEmbed = row.meals as unknown;
    const meal = (Array.isArray(mealEmbed) ? mealEmbed[0] : mealEmbed) as
      | { name: string; cuisines: unknown }
      | null
      | undefined;

    const cuisineEmbed = meal?.cuisines as unknown;
    const cuisineRow = (Array.isArray(cuisineEmbed) ? cuisineEmbed[0] : cuisineEmbed) as
      | { display_label: string }
      | null
      | undefined;

    return {
      mealId: row.meal_id as string,
      name: meal?.name ?? '',
      cuisineLabel: cuisineRow?.display_label ?? '',
      createdAt: req?.created_at ?? '',
    };
  });

  // Newest first. ISO strings sort lexicographically by time, so localeCompare
  // on createdAt is a correct chronological order.
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}
