import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { loadTasteProfile, saveTasteProfile, type BudgetLevel } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

type Cuisine = { id: string; display_label: string; emoji: string };

// Display labels + descriptions — duplicated locally (decoupled from onboarding).
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

// Local replicas of onboarding's CheckRow / RemovableTag (NOT imported — keeps
// this screen decoupled from the onboarding draft layout).
function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? colors.accent : colors.textSecondary}
      />
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

function RemovableTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label}`}
      style={styles.tag}
    >
      <Text variant="body" color="bg">
        {label}
      </Text>
      <Text variant="body" color="bg">
        ×
      </Text>
    </Pressable>
  );
}

type Status = 'loading' | 'ready' | 'error';

export default function TasteEdit() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]); // ordered, max 3
  const [disliked, setDisliked] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profile, { data: cuisineRows, error: cErr }] = await Promise.all([
          loadTasteProfile(),
          supabase.from('cuisines').select('id, display_label, emoji').order('display_label'),
        ]);
        if (cErr) throw cErr;
        if (!active) return;
        setCuisines((cuisineRows ?? []) as Cuisine[]);
        setFavorites(profile.favoriteCuisineIds);
        setDisliked(new Set(profile.dislikedCuisineIds));
        setIngredients(profile.dislikedIngredients);
        setEffort(profile.effort);
        setBudget(profile.budget);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Chosen favorites — an unordered set, max 3 (no rank): tapping toggles a
  // cuisine in/out; a 4th tap is ignored. Mutual exclusion: becoming a favorite
  // removes the cuisine from the "never suggest" avoid set.
  function pickFavorite(id: string) {
    setFavorites((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
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
  }

  function addIngredient() {
    const v = ingredientDraft.trim().toLowerCase();
    if (!v) return;
    setIngredients((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setIngredientDraft('');
  }

  function removeIngredient(name: string) {
    setIngredients((prev) => prev.filter((n) => n !== name));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveTasteProfile({
        favoriteCuisineIds: favorites,
        dislikedCuisineIds: [...disliked],
        dislikedIngredients: ingredients,
        effort,
        budget,
      });
      router.back();
    } catch {
      setSaving(false);
      setError('Couldn’t save your taste. Try once more.');
    }
  }

  const effortDescription = EFFORT_OPTIONS.find((o) => o.value === effort)?.description ?? '';
  const budgetDescription = BUDGET_OPTIONS.find((o) => o.value === budget)?.description ?? '';

  if (status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          Loading your taste…
        </Text>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.centered}>
        <Text variant="title">Couldn&apos;t open this.</Text>
        <Text variant="body" color="textSecondary">
          Try again.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title">Your taste</Text>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Favorite cuisine
          </Text>
          <Text variant="body" color="textSecondary">
            Pick up to three
          </Text>
          <View style={styles.chipRow}>
            {cuisines.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.display_label}`}
                selected={favorites.includes(c.id)}
                onPress={() => pickFavorite(c.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Cuisines to avoid
          </Text>
          <View style={styles.checkList}>
            {cuisines.map((c) =>
              favorites.includes(c.id) ? (
                // A favorite can't also be a "never suggest" — greyed, non-tappable.
                <View key={c.id} style={styles.disabledRow}>
                  <Ionicons name="square-outline" size={24} color={colors.textSecondary} />
                  <Text variant="body">{`${c.emoji} ${c.display_label}`}</Text>
                  <Text variant="caption" color="textSecondary">
                    Your favorite
                  </Text>
                </View>
              ) : (
                <CheckRow
                  key={c.id}
                  label={`${c.emoji} ${c.display_label}`}
                  checked={disliked.has(c.id)}
                  onPress={() => toggleDisliked(c.id)}
                />
              ),
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Ingredients to avoid
          </Text>
          <TextInput
            value={ingredientDraft}
            onChangeText={setIngredientDraft}
            onSubmitEditing={addIngredient}
            placeholder="Type an ingredient, press enter"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            returnKeyType="done"
            style={styles.input}
          />
          {ingredients.length > 0 ? (
            <View style={styles.chipRow}>
              {ingredients.map((name) => (
                <RemovableTag key={name} label={name} onRemove={() => removeIngredient(name)} />
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

        {error ? (
          <Text variant="body" color="text">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
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
  section: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  checkList: {
    gap: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  disabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    opacity: 0.6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
