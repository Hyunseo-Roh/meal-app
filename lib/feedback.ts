import { supabase } from './supabase';

/**
 * Meal feedback (free tier). The `feedback` table has NO meal_id and NO unique
 * constraint (PK on id only), so it is keyed per recommendation OPTION — which
 * is also the grain recommend_meals joins on to attribute its ±20 term
 * (feedback → recommendation_options → meal). loved_it = +20, not_for_me = −20.
 *
 * Because there is no unique constraint to ON CONFLICT against, we emulate the
 * upsert client-side: look up the existing row for (user, option), then
 * insert / update / delete. This ships before Auth, so everything is scoped to
 * the anonymous per-device user id.
 */

// Two-state control only. `fine` (the third rating_type enum value) is unused
// here, and reason chips are deferred.
export type Rating = 'loved_it' | 'not_for_me';

/** Current saved rating for this option, or null if none. */
export async function loadFeedback(userId: string, optionId: string): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('feedback')
    .select('rating')
    .eq('user_id', userId)
    .eq('option_id', optionId)
    .maybeSingle();

  if (error) throw new Error('feedback_load_failed');
  return (data?.rating as Rating | undefined) ?? null;
}

/**
 * Set (or clear, when `rating` is null) the feedback for one option. Emulated
 * upsert: one row per (user, option). Throws on failure so the caller can
 * surface an error and roll back the optimistic UI.
 */
export async function saveFeedback(
  userId: string,
  optionId: string,
  rating: Rating | null,
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('feedback')
    .select('id')
    .eq('user_id', userId)
    .eq('option_id', optionId)
    .maybeSingle();

  if (findError) throw new Error('feedback_save_failed');

  // Clear: remove the row if one exists.
  if (rating === null) {
    if (!existing) return;
    const { error } = await supabase.from('feedback').delete().eq('id', existing.id);
    if (error) throw new Error('feedback_save_failed');
    return;
  }

  // Change: update the existing row's rating in place.
  if (existing) {
    const { error } = await supabase
      .from('feedback')
      .update({ rating })
      .eq('id', existing.id);
    if (error) throw new Error('feedback_save_failed');
    return;
  }

  // New: insert. request_id is NOT NULL on feedback, so derive it from the
  // option row rather than trusting the caller to thread it through.
  const { data: option, error: optError } = await supabase
    .from('recommendation_options')
    .select('request_id')
    .eq('id', optionId)
    .single();

  if (optError || !option) throw new Error('feedback_save_failed');

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    request_id: option.request_id,
    option_id: optionId,
    rating,
    // feedback.created_at is NOT NULL with no DB default — must be set on insert.
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error('feedback_save_failed');
}
