import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../components/Chip';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { CURRENT_USER_ID } from '../lib/currentUser';
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

  const canSubmit = time !== null && budget !== null && !submitting;

  async function handleSubmit() {
    if (time === null || budget === null) return;
    setSubmitting(true);
    setError(null);

    // created_at is NOT NULL with no DB default, so set it explicitly.
    // energy / ingredients_on_hand / context_source / inferred_mood stay null.
    const { data, error: insertError } = await supabase
      .from('recommendation_requests')
      .insert({
        user_id: CURRENT_USER_ID,
        time_available: time,
        budget,
        mood, // null when skipped
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError("Couldn't set up tonight. Check your connection and try again.");
      return;
    }

    router.push({ pathname: '/request/[id]', params: { id: data.id } });
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
});
