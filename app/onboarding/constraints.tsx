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

const BUDGET_OPTIONS: { label: string; description: string; value: BudgetLevel }[] = [
  { label: 'Low', description: 'Under $3 a serving', value: 'low' },
  { label: 'Medium', description: '$3–6 a serving', value: 'medium' },
  { label: 'High', description: 'No limit', value: 'high' },
];

// Visual-only cook-time preference. Local state, intentionally NOT persisted —
// no DB column, no write. Mirrors the Home screen's time chips for parity.
const COOK_TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: 60 },
];

// Page 2 of 3 — Constraints. Collects effort + budget, then writes the whole
// draft to `users` in a single UPDATE (same save as before), marks the user
// onboarded, and moves on to the optional Pantry step.
export default function ConstraintsSetup() {
  const router = useRouter();
  const { favorites, ingredients, effort, setEffort, budget, setBudget } = useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Visual-only: cook-time selection lives here and is never written to the DB.
  const [cookTime, setCookTime] = useState<number | null>(null);

  const canContinue = effort !== null && budget !== null && !saving;
  const effortDescription = EFFORT_OPTIONS.find((o) => o.value === effort)?.description ?? '';
  const budgetDescription = BUDGET_OPTIONS.find((o) => o.value === budget)?.description ?? '';

  async function handleContinue() {
    if (favorites.length === 0 || effort === null || budget === null) return;
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

    // Wrap the write: a returned { error } AND a thrown network error (offline /
    // blocked domain, which rejects the fetch) both surface the same line and
    // re-enable the button, so it never sticks on "Saving…".
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          // Chosen favorites (unordered). The scalar mirrors any one of them so the
          // onboarding gate (currentUser.ts isOnboarded) stays non-null; the array
          // is what recommend_meals + reasons.ts read.
          pref_cuisine_ids: favorites,
          pref_cuisine_id: favorites[0] ?? null,
          // Onboarding no longer collects cuisine-avoids (the avoid screen dropped
          // that section); write an explicit empty set. Engine-independent — the
          // recommend RPC treats an empty disliked_cuisine_ids as "skip nothing".
          disliked_cuisine_ids: [],
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
    } catch {
      setSaving(false);
      setError("Couldn't save just now. Try once more.");
      return;
    }

    // Prefs saved == onboarded (per the pref_cuisine_id marker). Persist the
    // local flag so Screen 3's gate routes instantly without a DB read. This is
    // the end of onboarding — pantry is no longer part of the flow, so the user
    // is onboarded here with an empty pantry.
    await setLocalOnboarded(true);

    // Onboarding (3 steps) is complete. Hand off to the post-onboarding premium
    // intro — a separate, skippable soft-sell, not a 4th step.
    router.replace('/premium');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.replace('/onboarding/avoid')}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 3 of 3 */}
        <View style={styles.progress}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
        </View>
        <Text variant="caption" color="textSecondary">
          Step 3 of 3
        </Text>

        <View style={styles.header}>
          <Text variant="display">What works for you most nights?</Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Cook time
          </Text>
          <View style={styles.chipRow}>
            {COOK_TIME_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={cookTime === opt.value}
                // Visual-only: local state, persists nothing.
                onPress={() => setCookTime((prev) => (prev === opt.value ? null : opt.value))}
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
                // Tap again to deselect.
                onPress={() => setBudget((prev) => (prev === opt.value ? null : opt.value))}
              />
            ))}
          </View>
          {budgetDescription ? (
            <Text variant="body" color="textSecondary">
              {budgetDescription}
            </Text>
          ) : null}
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

        {error ? (
          <Text variant="body" color="text">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Continue'}
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
    // Pull the arrow toward the screen edge (arrow only — headings keep their margin).
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 0,
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
