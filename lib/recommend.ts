import { supabase } from './supabase';

export type Tier = 'familiar' | 'adjacent' | 'stretch';

/** One row from the recommend_meals RPC. */
export type RecRow = {
  tier: Tier;
  meal_id: string;
  meal: string;
  cuisine: string;
  effort_level: number;
  est_cost: number;
  cook_time_min: number;
  over_time: boolean;
  score: number;
};

/** A recommendation paired with its persisted recommendation_options.id. */
export type OptionCard = RecRow & {
  optionId: string;
  explanation: string;
};

export const TIER_LABEL: Record<Tier, string> = {
  familiar: 'Familiar',
  adjacent: 'Adjacent',
  stretch: 'Stretch',
};

const TIER_RANK: Record<Tier, number> = { familiar: 0, adjacent: 1, stretch: 2 };

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Short, rule-based one-liner per tier. No LLM. */
function buildExplanation(row: RecRow): string {
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
 * Load the three options for a request: read the request row, call the
 * rule-based RPC, persist the 3 options (idempotently), and return them in
 * tier order with their option ids. Throws on missing request / bad RPC result.
 */
export async function loadOptions(
  requestId: string,
): Promise<{ options: OptionCard[]; createdAt: string | null }> {
  // 1. The request row is the source of truth for the RPC params. created_at is
  //    also read (display only) so the screen can phrase its heading by the
  //    session's meal bucket — one extra column on an existing query.
  const { data: request, error: reqError } = await supabase
    .from('recommendation_requests')
    .select('user_id, time_available, budget, mood, created_at')
    .eq('id', requestId)
    .single();

  if (reqError || !request) {
    throw new Error('request_not_found');
  }

  // 2. Rule-based recommendation. Always returns exactly 3 rows.
  const { data: recs, error: rpcError } = await supabase.rpc('recommend_meals', {
    p_user_id: request.user_id,
    p_time_available: request.time_available,
    p_budget: request.budget,
    p_mood: request.mood,
  });

  if (rpcError || !recs || recs.length < 3) {
    throw new Error('recommend_failed');
  }

  const rows = (recs as RecRow[]).slice().sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);

  // 3. Persist idempotently: if options already exist for this request, reuse
  //    them (e.g. screen reloaded) rather than duplicating.
  const { data: existing } = await supabase
    .from('recommendation_options')
    .select('id, meal_id, tier')
    .eq('request_id', requestId);

  let optionByMeal = new Map<string, string>();

  if (existing && existing.length > 0) {
    for (const o of existing) optionByMeal.set(o.meal_id as string, o.id as string);
  } else {
    const payload = rows.map((row, i) => ({
      request_id: requestId,
      meal_id: row.meal_id,
      tier: row.tier,
      explanation: buildExplanation(row),
      was_selected: false, // selection happens on a later screen; NOT NULL, no DB default
      tier_order: i,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from('recommendation_options')
      .insert(payload)
      .select('id, meal_id');
    if (insertError || !inserted) {
      throw new Error('persist_failed');
    }
    for (const o of inserted) optionByMeal.set(o.meal_id as string, o.id as string);
  }

  const options = rows.map((row) => ({
    ...row,
    optionId: optionByMeal.get(row.meal_id) ?? '',
    explanation: buildExplanation(row),
  }));

  return { options, createdAt: request.created_at ?? null };
}
