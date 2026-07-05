import { getCurrentUserId } from './currentUser';
import { supabase } from './supabase';
import type { Tier } from './recommend';

export type WhyData = {
  mealId: string;
  name: string;
  cuisineLabel: string;
  effortLevel: number;
  cookTimeMin: number;
  estCost: number;
  description: string | null;
  tier: Tier;
  reasons: string[];
};

type BudgetLevel = 'low' | 'medium' | 'high';

// Per-serving dollar ceilings used only to phrase the budget reason (display
// logic, NOT the recommend_meals RPC's budget scoring, which stays as-is — so
// the two can diverge at the margins). Tiers (per user survey + reseeded
// $1.2–$7.8 spread): low < 3, medium 3–6, high > 6. These are ceilings for the
// user's SELECTED budget, so high stays Infinity (accepts every meal).
const BUDGET_CEILING: Record<BudgetLevel, number> = {
  low: 3,
  medium: 6,
  high: Infinity,
};

const TIER_REASON: Record<Tier, string> = {
  familiar: 'Right in your usual lane.',
  adjacent: 'A small step from what you know.',
  stretch: 'A little further than usual — worth a try.',
};

/**
 * Build the calm, rule-based "why" lines for one option. Every line is TRUE for
 * this specific meal + Sofia + session. Up to 4 lines, no LLM. Computed from
 * real columns so different meals/tiers yield different sets.
 */
export async function loadWhy(optionId: string): Promise<WhyData> {
  // 1. The option: links the meal, the request, and the tier.
  const { data: option, error: optErr } = await supabase
    .from('recommendation_options')
    .select('meal_id, request_id, tier')
    .eq('id', optionId)
    .single();
  if (optErr || !option) throw new Error('option_not_found');

  // 2. Meal (+ cuisine label via the disambiguated FK embed).
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .select(
      'name, cuisine_id, effort_level, cook_time_min, est_cost, description, cuisines!fk_meals_cuisine(display_label)',
    )
    .eq('id', option.meal_id)
    .single();
  if (mealErr || !meal) throw new Error('meal_not_found');

  // 3. Session context.
  const { data: request, error: reqErr } = await supabase
    .from('recommendation_requests')
    .select('time_available, budget')
    .eq('id', option.request_id)
    .single();
  if (reqErr || !request) throw new Error('request_not_found');

  // 4. Current anonymous user's prefs.
  const userId = await getCurrentUserId();
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('pref_cuisine_id, pref_effort')
    .eq('id', userId)
    .single();
  if (userErr || !user) throw new Error('user_not_found');

  // The FK embed is typed as an array but returns a single object for this
  // many-to-one relation; normalize either shape.
  const cuisineEmbed = meal.cuisines as unknown;
  const cuisineRow = (
    Array.isArray(cuisineEmbed) ? cuisineEmbed[0] : cuisineEmbed
  ) as { display_label: string } | null | undefined;
  const cuisineLabel = cuisineRow?.display_label ?? '';
  const tier = option.tier as Tier;
  const reasons: string[] = [];

  // tier — always holds
  reasons.push(TIER_REASON[tier]);

  // cuisine match
  if (meal.cuisine_id && meal.cuisine_id === user.pref_cuisine_id && cuisineLabel) {
    reasons.push(`You tend to like ${cuisineLabel}.`);
  }

  // effort fit (only when it genuinely fits — omit if more effort than wanted)
  if (meal.effort_level === 1) {
    reasons.push('Low effort, like you wanted.');
  } else if (meal.effort_level === user.pref_effort) {
    reasons.push("About the effort you're up for.");
  } else if (meal.effort_level < user.pref_effort) {
    reasons.push('A little easier than usual.');
  }

  // time fit
  if (request.time_available != null) {
    if (meal.cook_time_min <= request.time_available) {
      reasons.push('Fits your time.');
    } else {
      reasons.push('A little longer, but close.');
    }
  }

  // budget fit
  if (request.budget && meal.est_cost <= BUDGET_CEILING[request.budget as BudgetLevel]) {
    reasons.push('Comfortable on your budget.');
  }

  return {
    mealId: option.meal_id,
    name: meal.name,
    cuisineLabel,
    effortLevel: meal.effort_level,
    cookTimeMin: meal.cook_time_min,
    estCost: meal.est_cost,
    description: meal.description,
    tier,
    reasons: reasons.slice(0, 4),
  };
}
