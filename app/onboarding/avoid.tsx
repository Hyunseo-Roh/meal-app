import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';
import { CheckRow, RemovableTag, useOnboarding } from './_layout';

type Cuisine = { id: string; display_label: string; emoji: string };

// Page 2 of 3 — Never suggest / skip. Multi-select cuisines to avoid + a
// free-text list of ingredients to skip. Both optional; selections live in the
// shared draft and are saved at the end of Page 3 (Constraints).
export default function AvoidSetup() {
  const router = useRouter();
  const { favorites, setFavorites, disliked, setDisliked, ingredients, setIngredients } =
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

  // Mutually exclusive with the favorite chosen on Page 1.
  function toggleDisliked(id: string) {
    setDisliked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFavorites((prev) => prev.filter((f) => f !== id));
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
          <Text variant="title">Anything to avoid?</Text>
          <Text variant="body" color="textSecondary">
            Optional — skip cuisines or ingredients you don&apos;t want.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Never suggest
          </Text>
          <Text variant="body" color="textSecondary">
            Optional. Pick any.
          </Text>
          <View style={styles.checkList}>
            {cuisines.map((c) => {
              const favRank = favorites.indexOf(c.id); // >= 0 when this row is a ranked favorite
              return favRank >= 0 ? (
                // Your favorite can't also be a "never suggest" — show it
                // disabled with a small note instead of a tappable checkbox.
                <View key={c.id} style={styles.disabledRow}>
                  <Ionicons name="square-outline" size={24} color={colors.textSecondary} />
                  <Text variant="body">{`${c.emoji} ${c.display_label}`}</Text>
                  <Text variant="caption" color="textSecondary">
                    {`Your ${['1st', '2nd', '3rd'][favRank] ?? `${favRank + 1}th`} favorite`}
                  </Text>
                </View>
              ) : (
                <CheckRow
                  key={c.id}
                  label={`${c.emoji} ${c.display_label}`}
                  checked={disliked.has(c.id)}
                  onPress={() => toggleDisliked(c.id)}
                />
              );
            })}
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
                <RemovableTag key={name} label={name} onRemove={() => removeIngredient(name)} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue."
          onPress={() => router.replace('/onboarding/constraints')}
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
  checkList: {
    gap: spacing.xs,
  },
  // Mirrors CheckRow's row layout exactly (no layout shift), but dimmed and
  // non-tappable — the favorite can't also be a "never suggest".
  disabledRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    opacity: 0.6,
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
