import { getCurrentUserId, withTimeout } from './currentUser';
import { supabase } from './supabase';

/**
 * "Made meals" history for the History tab. Read-only — reuses the existing
 * `recommendation_options.was_selected = true` marker that confirm/[id].tsx
 * already writes when a user taps "Make this". No history table, no new write.
 *
 * Rooted at recommendation_requests (which carries created_at + user_id) with
 * the selected option inner-embedded, so the list can be ordered AND paged
 * server-side by created_at. recommendation_options has no timestamp of its own,
 * so an options-rooted query can't be range()-paged newest-first — hence the
 * request is the FROM table and the option/meal ride along as a to-one embed
 * (exactly one selected option per request). Does NOT touch recommend_meals /
 * get_ingredient_gap / scoring.
 */
export type HistoryEntry = {
  mealId: string;
  name: string;
  cuisineLabel: string;
  imageUrl: string | null;
  createdAt: string; // ISO, from recommendation_requests.created_at
};

/** Page size for the History list. Profile's preview slices its own 3 client-side. */
export const HISTORY_PAGE_SIZE = 20;

/**
 * One page of made-meal history, newest first.
 *
 * A single ranged query — no second query, no fetch-all-then-slice. `offset` is
 * the 0-based first row; the caller appends each page and stops once a page
 * returns fewer than HISTORY_PAGE_SIZE rows (the last page). Order is server-side
 * on created_at, so range() walks a stable newest-first sequence.
 *
 * Profile's preview calls this with the default (first page) and slices its own
 * 3 — a page is always ≥ 3 unless the user has made fewer than 3 meals.
 */
export async function loadHistory(offset = 0): Promise<HistoryEntry[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await withTimeout(
    supabase
      .from('recommendation_requests')
      .select(
        'created_at, recommendation_options!inner(meal_id, was_selected, meals!fk_options_meal(name, image_url, cuisines!fk_meals_cuisine(display_label)))',
      )
      .eq('user_id', userId)
      // Inner-join only the request's SELECTED option (the meal that got made).
      .eq('recommendation_options.was_selected', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1),
  );
  if (error || !data) throw new Error('history_load_failed');

  const entries: HistoryEntry[] = (data as Record<string, unknown>[]).map((row) => {
    const createdAt = (row.created_at as string) ?? '';

    // The inner-joined selected option — object-or-array normalize (same guard
    // as gap.ts). Present by construction (inner join on was_selected = true).
    const optEmbed = row.recommendation_options as unknown;
    const opt = (Array.isArray(optEmbed) ? optEmbed[0] : optEmbed) as
      | { meal_id: string; meals: unknown }
      | null
      | undefined;

    const mealEmbed = opt?.meals as unknown;
    const meal = (Array.isArray(mealEmbed) ? mealEmbed[0] : mealEmbed) as
      | { name: string; image_url: string | null; cuisines: unknown }
      | null
      | undefined;

    const cuisineEmbed = meal?.cuisines as unknown;
    const cuisineRow = (Array.isArray(cuisineEmbed) ? cuisineEmbed[0] : cuisineEmbed) as
      | { display_label: string }
      | null
      | undefined;

    return {
      mealId: opt?.meal_id ?? '',
      name: meal?.name ?? '',
      cuisineLabel: cuisineRow?.display_label ?? '',
      imageUrl: meal?.image_url ?? null,
      createdAt,
    };
  });

  return entries;
}
