import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../components/Chip';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import {
  getCurrentUserId,
  getLocalOnboarded,
  isOnboarded,
  setLocalOnboarded,
  withTimeout,
} from '../lib/currentUser';
import { supabase } from '../lib/supabase';
import { spacing } from '../theme/tokens';

type BudgetLevel = 'low' | 'medium' | 'high';

const TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: 60 },
];

const BUDGET_OPTIONS: { label: string; value: BudgetLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

// Mood is per-session, optional, and skippable. Free-ish presets only.
const MOOD_OPTIONS = ['Tired', 'Comfort', 'Adventurous', 'Light', 'Quick'];

export default function HowsTonight() {
  const router = useRouter();

  const [time, setTime] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);
  const [mood, setMood] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate: routed purely from the LOCAL onboarded flag — no network round-trip —
  // so Screen 3 becomes interactive instantly on every entry (cold mount AND
  // back-navigation / re-focus) and can never hang on "One moment…".
  const [gate, setGate] = useState<'checking' | 'ready'>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Re-entering the screen must always show an interactive form: clear any
      // leftover submitting state from a prior navigation (native keeps the
      // screen mounted, so this state otherwise persists and disables the button).
      setSubmitting(false);
      setError(null);

      (async () => {
        const localDone = await getLocalOnboarded();
        if (!active) return;
        if (localDone) {
          setGate('ready');
          return;
        }
        // No local proof of onboarding. Back-fill quietly with a timeout-guarded
        // DB check so a pre-existing (DB-onboarded) user isn't sent through
        // onboarding again — but never block: on not-onboarded / failure /
        // timeout, route to onboarding (the safe default for a fresh user).
        try {
          const dbDone = await withTimeout(isOnboarded());
          if (!active) return;
          if (dbDone) {
            setLocalOnboarded(true);
            setGate('ready');
            return;
          }
        } catch {
          // fall through to onboarding
        }
        if (active) router.replace('/onboarding/taste');
      })();

      return () => {
        active = false;
      };
    }, [router]),
  );

  const canSubmit = time !== null && budget !== null && !submitting;

  async function handleSubmit() {
    if (time === null || budget === null) return;
    setSubmitting(true);
    setError(null);

    // Resolve the per-device anonymous user (created on first run).
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch {
      setSubmitting(false);
      setError("Couldn't set up tonight. Check your connection and try again.");
      return;
    }

    // created_at is NOT NULL with no DB default, so set it explicitly.
    // energy / ingredients_on_hand / context_source / inferred_mood stay null.
    // Timeout-guarded so a stalled request surfaces the calm retry error
    // instead of hanging on "One moment…".
    try {
      const { data, error: insertError } = await withTimeout(
        supabase
          .from('recommendation_requests')
          .insert({
            user_id: userId,
            time_available: time,
            budget,
            mood, // null when skipped
            created_at: new Date().toISOString(),
          })
          .select()
          .single(),
      );

      if (insertError || !data) {
        setSubmitting(false);
        setError("Couldn't set up tonight. Check your connection and try again.");
        return;
      }

      router.push({ pathname: '/request/[id]', params: { id: data.id } });
    } catch {
      setSubmitting(false);
      setError("Couldn't set up tonight. Check your connection and try again.");
    }
  }

  if (gate === 'checking') {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          One moment…
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title" style={styles.heading}>
          How&apos;s tonight?
        </Text>
        <Text variant="body" color="textSecondary" style={styles.subhead}>
          Set the scene. We&apos;ll pick three.
        </Text>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            How long
          </Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={time === opt.value}
                onPress={() => setTime(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Budget
          </Text>
          <View style={styles.chipRow}>
            {BUDGET_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={budget === opt.value}
                onPress={() => setBudget(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Mood — optional
          </Text>
          <View style={styles.chipRow}>
            {MOOD_OPTIONS.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={mood === m}
                // Tap again to clear — mood is skippable.
                onPress={() => setMood((prev) => (prev === m ? null : m))}
              />
            ))}
          </View>
        </View>

        {error ? (
          <Text variant="body" color="text" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'One moment…' : "See tonight's three."}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  heading: {
    marginBottom: spacing.xs,
  },
  subhead: {
    marginTop: -spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    marginTop: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  centered: {
    justifyContent: 'center',
  },
});
