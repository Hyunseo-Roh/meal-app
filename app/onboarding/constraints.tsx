import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getCurrentUserId, setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';
import { useOnboarding, type BudgetLevel } from './_layout';

// Display labels/descriptions only. The stored value stays the same int
// (pref_effort 1-3, low->high effort) that the scoring function reads.
const EFFORT_OPTIONS: { label: string; description: string; value: number }[] = [
  { label: 'Easy', description: 'Minimal prep, few steps', value: 1 },
  { label: 'Medium', description: 'A bit of cooking', value: 2 },
  { label: 'Involved', description: 'Worth the extra time', value: 3 },
];

const BUDGET_OPTIONS: { label: string; value: BudgetLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

// Page 2 of 3 — Constraints. Collects effort + budget, then writes the whole
// draft to `users` in a single UPDATE (same save as before), marks the user
// onboarded, and moves on to the optional Pantry step.
export default function ConstraintsSetup() {
  const router = useRouter();
  const { favorite, disliked, ingredients, effort, setEffort, budget, setBudget } =
    useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = effort !== null && budget !== null && !saving;
  const effortDescription = EFFORT_OPTIONS.find((o) => o.value === effort)?.description ?? '';

  async function handleContinue() {
    if (favorite === null || effort === null || budget === null) return;
    setSaving(true);
    setError(null);

    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch {
      setSaving(false);
      setError("Couldn't save just now. Try once more.");
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        pref_cuisine_id: favorite,
        disliked_cuisine_ids: [...disliked],
        disliked_ingredients: ingredients,
        pref_effort: effort,
        default_budget: budget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      setSaving(false);
      setError("Couldn't save just now. Try once more.");
      return;
    }

    // Prefs saved == onboarded (per the pref_cuisine_id marker). Persist the
    // local flag so Screen 3's gate routes instantly without a DB read.
    await setLocalOnboarded(true);

    router.replace('/onboarding/pantry');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.replace('/onboarding/taste')}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 2 of 3 */}
        <View style={styles.progress}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>
        <Text variant="caption" color="textSecondary">
          Step 2 of 3
        </Text>

        <View style={styles.header}>
          <Text variant="title">Your limits tonight.</Text>
          <Text variant="body" color="textSecondary">
            How much effort, and what you&apos;re spending.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Effort
          </Text>
          <View style={styles.chipRow}>
            {EFFORT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={effort === opt.value}
                // Tap again to deselect.
                onPress={() => setEffort((prev) => (prev === opt.value ? null : opt.value))}
              />
            ))}
          </View>
          {effortDescription ? (
            <Text variant="body" color="textSecondary">
              {effortDescription}
            </Text>
          ) : null}
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
                // Tap again to deselect.
                onPress={() => setBudget((prev) => (prev === opt.value ? null : opt.value))}
              />
            ))}
          </View>
        </View>

        {error ? (
          <Text variant="body" color="text">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Continue.'}
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  progressActive: {
    backgroundColor: colors.accent,
  },
  progressInactive: {
    backgroundColor: colors.chipBorder,
  },
  header: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
