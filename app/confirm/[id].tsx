import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeedbackControl } from '../../components/FeedbackControl';
import { MealImage } from '../../components/MealImage';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { markMealCompleted } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../theme/tokens';

type Meal = { name: string; cook_time_min: number; est_cost: number; image_url: string | null };

export default function Handled() {
  const { id, option_id } = useLocalSearchParams<{ id: string; option_id?: string }>();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  // The meal name/meta is fetched, so it has a brief loading moment on this
  // critical-path screen. Starts true; resolves once the fetch settles.
  const [mealLoading, setMealLoading] = useState(true);
  // Calm note shown only if the selection couldn't be recorded.
  const [writeNote, setWriteNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // The one meaningful write: mark the chosen option selected. Idempotent —
    // only this option flips to true; the other two stay false. Degrade
    // gracefully if option_id is absent (e.g. deep link).
    async function recordSelection() {
      if (!option_id) {
        if (active) setWriteNote('Not linked to your three meals, but it’s yours to make');
        return;
      }
      const { error } = await supabase
        .from('recommendation_options')
        .update({ was_selected: true })
        .eq('id', option_id);
      if (error && active) {
        setWriteNote('The pick didn’t save — no matter, go make it');
      }
    }

    async function loadMeal() {
      if (!id) {
        if (active) setMealLoading(false);
        return;
      }
      const { data } = await supabase
        .from('meals')
        .select('name, cook_time_min, est_cost, image_url')
        .eq('id', id)
        .single();
      if (active) {
        setMeal(data ?? null);
        setMealLoading(false);
      }
    }

    // Reaching Handled from the Home flow (we have an option_id) completes a meal
    // decision — signal Home to start the next meal with a fresh swap budget.
    if (option_id) markMealCompleted();

    recordSelection();
    loadMeal();
    return () => {
      active = false;
    };
  }, [id, option_id]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.block}>
        {/* The commitment moment — the meal you're about to make, pictured.
            Greige fallback (via MealImage) if the photo is null or slow. */}
        <MealImage url={meal?.image_url ?? null} width="100%" height={140} upsize />
        <Text variant="display">You&apos;re set</Text>
        {mealLoading ? (
          <LoadingState message="Getting your meal…" />
        ) : meal ? (
          <>
            <Text variant="title" style={styles.meal}>
              {`You’re making ${meal.name}`}
            </Text>
            <Text variant="caption" color="textSecondary">
              {`${meal.cook_time_min} min`} · {formatCost(meal.est_cost)}
            </Text>
          </>
        ) : null}
        {writeNote ? (
          <Text variant="body" color="textSecondary" style={styles.note}>
            {writeNote}
          </Text>
        ) : null}
      </View>

      {/* Taste feedback (free tier) — a POST-cook signal, so it lives here on
          Handled. FeedbackControl renders its own "Your take" caption and writes
          the same feedback row (loved_it / not_for_me), keyed per option. Shown
          only when we arrived with an option_id (absent on a deep link). */}
      {option_id ? <FeedbackControl optionId={option_id} /> : null}

      <Pressable
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        style={styles.backLink}
      >
        <Text variant="caption" color="accent">
          Back to start
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.xl,
  },
  block: {
    gap: spacing.md,
  },
  meal: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.sm,
  },
  backLink: {
    marginTop: spacing.xl,
    // Vertical centering only — no alignItems, to preserve the original
    // (non-centered) horizontal alignment of this link.
    justifyContent: 'center',
    minHeight: 44,
  },
});
