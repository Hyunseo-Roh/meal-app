import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FeedbackControl } from '../../components/FeedbackControl';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { loadGapCounts } from '../../lib/gap';
import { markMealCompleted } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

type Meal = { name: string; cook_time_min: number; est_cost: number };

export default function Handled() {
  const { id, option_id } = useLocalSearchParams<{ id: string; option_id?: string }>();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealLoading, setMealLoading] = useState(true);
  // The pantry-memory count for this meal (payoff), or null until it resolves /
  // on error — the line simply doesn't render then.
  const [gap, setGap] = useState<{ have: number; total: number } | null>(null);
  // Calm note shown only if the selection couldn't be recorded.
  const [writeNote, setWriteNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // The one meaningful write: mark the chosen option selected. Idempotent.
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
        .select('name, cook_time_min, est_cost')
        .eq('id', id)
        .single();
      if (active) {
        setMeal(data ?? null);
        setMealLoading(false);
      }
      // The pantry count — best-effort; a failure just hides the line.
      try {
        const counts = await loadGapCounts(id);
        if (active) setGap(counts);
      } catch {
        // no count line
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
      {/* Back to the recipe — no dead end. */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>

      <View style={styles.block}>
        <Text variant="display">You&apos;re set</Text>
        {mealLoading ? (
          <LoadingState message="Getting your meal…" delayMs={250} />
        ) : meal ? (
          <>
            <Text variant="title" style={styles.meal}>
              {`You’re making ${meal.name}`}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.metaCaption}>
              {`${meal.cook_time_min} min · ${formatCost(meal.est_cost)}`}
            </Text>
            {/* Pantry-memory payoff — what you already have for it. */}
            {gap ? (
              <View style={styles.gapRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.have} />
                <Text variant="body" color="toast">
                  {`${gap.have} of ${gap.total}`}
                </Text>
                <Text variant="body" color="textSecondary">
                  {' ingredients'}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {writeNote ? (
          <Text variant="body" color="textSecondary" style={styles.note}>
            {writeNote}
          </Text>
        ) : null}
      </View>

      {/* Taste feedback (free tier) — a POST-cook thumbs signal, keyed per option.
          Shown only when we arrived with an option_id (absent on a deep link). */}
      {option_id ? <FeedbackControl optionId={option_id} /> : null}

      {/* Clear exit — the payoff's done action. */}
      <View style={styles.footer}>
        <PrimaryButton label="Done" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  backArrow: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    paddingRight: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  block: {
    gap: spacing.md,
  },
  meal: {
    marginTop: spacing.sm,
  },
  metaCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  note: {
    marginTop: spacing.sm,
  },
  // Push the Done button to the bottom of the screen.
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
});
