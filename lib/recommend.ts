import { supabase } from './supabase';

export type Tier = 'familiar' | 'adjacent' | 'stretch';
export type BudgetLevel = 'low' | 'medium' | 'high';

/** One row from the recommend_meals RPC (up to 4 per tier). */
export type RecRow = {
  tier: Tier;
  /** Within-tier rank: 0 = the shown card, 1..3 = swap alternates. */
  tier_rank: number;
  meal_id: string;
  meal: string;
  cuisine: string;
  effort_level: number;
  est_cost: number;
  cook_time_min: number;
  over_time: boolean;
  score: number;
};

/**
 * Session filters passed to the RPC. `null` means UNSET — the RPC coalesces a
 * null budget to the user's saved default_budget, and a null time applies no
 * over-time penalty, so first open (all null) is driven purely by saved prefs.
 */
export type RecParams = {
  time: number | null;
  budget: BudgetLevel | null;
  mood: string | null;
};

export const TIER_LABEL: Record<Tier, string> = {
  familiar: 'Familiar',
  adjacent: 'Adjacent',
  stretch: 'Stretch',
};

export const TIER_RANK: Record<Tier, number> = { familiar: 0, adjacent: 1, stretch: 2 };

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Short, rule-based one-liner per tier. No LLM. */
export function buildExplanation(row: RecRow): string {
  const cuisine = capitalize(row.cuisine);
  switch (row.tier) {
    case 'familiar':
      return `A familiar ${cuisine} pick, right in your lane.`;
    case 'adjacent':
      return `One small step over — still comfortable ${cuisine}.`;
    case 'stretch':
      return `Something new: ${cuisine}.`;
  }
}

/**
 * Pure recommendation read: calls the rule-based RPC and returns ALL candidate
 * rows (up to 4 per tier). Writes NOTHING — this drives the live, filter-driven
 * preview on Home, so changing a filter is a single read with no DB churn.
 * Throws if the RPC fails or doesn't return one shown card (tier_rank 0) per tier.
 */
export async function fetchRecommendations(userId: string, params: RecParams): Promise<RecRow[]> {
  const { data: recs, error } = await supabase.rpc('recommend_meals', {
    p_user_id: userId,
    p_time_available: params.time,
    p_budget: params.budget,
    p_mood: params.mood,
  });
  const rows = (recs as RecRow[] | null) ?? [];
  const shownTiers = new Set(rows.filter((r) => r.tier_rank === 0).map((r) => r.tier));
  if (error || shownTiers.size < 3) throw new Error('recommend_failed');
  return rows;
}

/**
 * Commit-time persistence: insert the request row for these filters and persist
 * ALL candidate options (shown + swap alternates) so downstream screens — and the
 * swap feature that lands next — can reference recommendation_options by id.
 * `tier_order` carries the within-tier rank (0 = shown, 1..3 = alternates).
 *
 * Called on FIRST ENGAGEMENT (first card tap OR first swap), never on filter
 * changes. Callers must guard so it runs at most once per shown set. Returns the
 * new request id and a meal_id -> option_id map for navigation.
 */
export async function materializeSelection(
  userId: string,
  params: RecParams,
  rows: RecRow[],
): Promise<{ requestId: string; optionByMeal: Map<string, string> }> {
  const { data: request, error: reqError } = await supabase
    .from('recommendation_requests')
    .insert({
      user_id: userId,
      time_available: params.time,
      budget: params.budget,
      mood: params.mood, // null when unset
      created_at: new Date().toISOString(), // NOT NULL, no DB default
    })
    .select('id')
    .single();
  if (reqError || !request) throw new Error('persist_failed');
  const requestId = request.id as string;

  const ordered = rows
    .slice()
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.tier_rank - b.tier_rank);
  const payload = ordered.map((row) => ({
    request_id: requestId,
    meal_id: row.meal_id,
    tier: row.tier,
    explanation: buildExplanation(row),
    was_selected: false, // selection happens on the Handled screen; NOT NULL, no default
    tier_order: row.tier_rank, // within-tier rank: 0 = shown card, 1..3 = alternates
  }));
  const { data: inserted, error: insertError } = await supabase
    .from('recommendation_options')
    .insert(payload)
    .select('id, meal_id');
  if (insertError || !inserted) throw new Error('persist_failed');

  const optionByMeal = new Map<string, string>();
  for (const o of inserted) optionByMeal.set(o.meal_id as string, o.id as string);
  return { requestId, optionByMeal };
}
