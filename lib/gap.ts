import { getCurrentUserId } from './currentUser';
import { supabase } from './supabase';

export type GapData = {
  name: string;
  cuisineLabel: string;
  effortLevel: number;
  cookTimeMin: number;
  estCost: number;
  imageUrl: string | null;
  description: string | null;
  /** Ordered cooking steps. NULL = not yet seeded; [] = seeded, no steps upstream. */
  instructions: string[] | null;
  have: string[];
  toBuy: string[];
  n: number; // count the user has
  m: number; // total ingredients
  consistent: boolean; // n + toBuy.length === m (true by RPC construction)
};

type GapRow = { ingredient: string; have: boolean };

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Load the meal header + the have/to-buy split from get_ingredient_gap.
 *
 * The RPC returns exactly one row per meal ingredient with a `have` flag, so
 * the counts are internally consistent by construction: every ingredient lands
 * in exactly one list and N + toBuy = M. We still compute `consistent` and
 * surface it rather than fudging.
 */
export async function loadGap(mealId: string): Promise<GapData> {
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .select(
      'name, effort_level, cook_time_min, est_cost, image_url, description, instructions, cuisines!fk_meals_cuisine(display_label)',
    )
    .eq('id', mealId)
    .single();
  if (mealErr || !meal) throw new Error('meal_not_found');

  const userId = await getCurrentUserId();
  const { data: rows, error: gapErr } = await supabase.rpc('get_ingredient_gap', {
    p_user_id: userId,
    p_meal_id: mealId,
  });
  if (gapErr || !rows) throw new Error('gap_failed');

  const gapRows = rows as GapRow[];
  const have = gapRows.filter((r) => r.have).map((r) => capitalize(r.ingredient));
  const toBuy = gapRows.filter((r) => !r.have).map((r) => capitalize(r.ingredient));

  const m = gapRows.length;
  const n = have.length;

  const cuisineEmbed = meal.cuisines as unknown;
  const cuisineRow = (
    Array.isArray(cuisineEmbed) ? cuisineEmbed[0] : cuisineEmbed
  ) as { display_label: string } | null | undefined;

  return {
    name: meal.name,
    cuisineLabel: cuisineRow?.display_label ?? '',
    effortLevel: meal.effort_level,
    cookTimeMin: meal.cook_time_min,
    estCost: meal.est_cost,
    imageUrl: meal.image_url ?? null,
    description: meal.description,
    instructions: meal.instructions,
    have,
    toBuy,
    n,
    m,
    consistent: n + toBuy.length === m,
  };
}
