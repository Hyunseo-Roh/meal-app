import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';
import { useOnboarding } from './_layout';

type Cuisine = { id: string; display_label: string; emoji: string };

// Page 1 of 3 — Taste. Collects favorite cuisine, cuisines to never suggest,
// and ingredients to skip. Nothing is saved here; selections live in the shared
// onboarding draft and are written once at the end of Page 2 (Constraints).
export default function TasteSetup() {
  const router = useRouter();
  const { favorite, setFavorite, disliked, setDisliked, ingredients, setIngredients } =
    useOnboarding();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState('');

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

  const canContinue = favorite !== null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1 of 3 */}
        <View style={styles.progress}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>
        <Text variant="caption" color="textSecondary">
          Step 1 of 3
        </Text>

        <View style={styles.header}>
          <Text variant="title">What sounds good?</Text>
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
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue."
          onPress={() => router.replace('/onboarding/constraints')}
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
