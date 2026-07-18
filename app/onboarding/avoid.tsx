import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing, typography } from '../../theme/tokens';
import { RemovableTag, useOnboarding } from './_layout';

// Visual-only dietary preferences. Local component state, intentionally NOT
// persisted — no DB column, no write to users. Presentation parity only.
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];

// Page 2 of 3 — Avoid. A free-text list of ingredients to skip (the only signal
// saved here) plus visual-only dietary tags. Cuisine-level avoids were removed:
// people don't skip whole cuisines, and it overlapped the favorite signal.
export default function AvoidSetup() {
  const router = useRouter();
  const { ingredients, setIngredients } = useOnboarding();

  const [ingredientDraft, setIngredientDraft] = useState('');
  // Visual-only: dietary selections live here and are never written to the DB.
  const [dietary, setDietary] = useState<Set<string>>(new Set());

  function toggleDietary(name: string) {
    setDietary((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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
          <Text variant="display">Anything to avoid?</Text>
          <Text variant="body" color="textSecondary">
            Optional — leave out anything you&apos;d rather not see.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Ingredients
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

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Dietary
          </Text>
          <View style={styles.chipRow}>
            {DIETARY_OPTIONS.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={dietary.has(d)}
                onPress={() => toggleDietary(d)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue"
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
