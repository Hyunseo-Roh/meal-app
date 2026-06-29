import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getCurrentUserId, setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

type BudgetLevel = 'low' | 'medium' | 'high';
type Cuisine = { id: string; display_label: string; emoji: string };

const EFFORT_OPTIONS: { label: string; value: number }[] = [
  { label: 'Quick', value: 1 },
  { label: 'Easy', value: 2 },
  { label: 'Worth the time', value: 3 },
];

const BUDGET_OPTIONS: { label: string; value: BudgetLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

export default function TasteSetup() {
  const router = useRouter();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [favorite, setFavorite] = useState<string | null>(null);
  const [disliked, setDisliked] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('cuisines')
      .select('id, display_label, emoji')
      .order('display_label')
      .then(({ data }) => {
        if (active && data) setCuisines(data as Cuisine[]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Favorite and disliked are mutually exclusive — selecting one clears the
  // conflicting choice in the other.
  function pickFavorite(id: string) {
    setFavorite((prev) => (prev === id ? null : id));
    setDisliked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleDisliked(id: string) {
    setDisliked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFavorite((prev) => (prev === id ? null : prev));
  }

  function addIngredient() {
    const v = ingredientDraft.trim().toLowerCase();
    if (!v) return;
    setIngredients((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setIngredientDraft('');
  }

  function removeIngredient(name: string) {
    setIngredients((prev) => prev.filter((x) => x !== name));
  }

  const canContinue = favorite !== null && effort !== null && budget !== null && !saving;

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1 of 2 */}
        <View style={styles.progress}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>
        <Text variant="caption" color="textSecondary">
          Step 1 of 2
        </Text>

        <View style={styles.header}>
          <Text variant="title">A few taps and we&apos;ll take it from here.</Text>
          <Text variant="body" color="textSecondary">
            Your taste, once — so every night picks itself.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Favorite cuisine
          </Text>
          <View style={styles.chipRow}>
            {cuisines.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.display_label}`}
                selected={favorite === c.id}
                onPress={() => pickFavorite(c.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Never suggest
          </Text>
          <Text variant="body" color="textSecondary">
            We&apos;ll never suggest these.
          </Text>
          <View style={styles.chipRow}>
            {cuisines.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.display_label}`}
                selected={disliked.has(c.id)}
                onPress={() => toggleDisliked(c.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Skip ingredients
          </Text>
          <TextInput
            value={ingredientDraft}
            onChangeText={setIngredientDraft}
            onSubmitEditing={addIngredient}
            placeholder="Type an ingredient, press enter"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            style={styles.input}
          />
          {ingredients.length > 0 ? (
            <View style={styles.chipRow}>
              {ingredients.map((name) => (
                <Chip key={name} label={name} selected onPress={() => removeIngredient(name)} />
              ))}
            </View>
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
                onPress={() => setEffort(opt.value)}
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
  content: {
    paddingTop: spacing.xl,
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
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
