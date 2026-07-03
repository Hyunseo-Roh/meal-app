import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';
import { useOnboarding } from './_layout';

type Cuisine = { id: string; display_label: string; emoji: string };

// Page 1 of 3 — Taste. Favorite cuisine only (kept on its own page since it may
// gain ranking UI later). Nothing is saved here; selections live in the shared
// onboarding draft and are written once at the end of Page 3 (Constraints).
export default function TasteSetup() {
  const router = useRouter();
  const { favorite, setFavorite, setDisliked } = useOnboarding();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);

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

  // Favorite and never-suggest (Page 2) are mutually exclusive — picking a
  // favorite clears it from the skip list.
  function pickFavorite(id: string) {
    setFavorite((prev) => (prev === id ? null : id));
    setDisliked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue."
          onPress={() => router.replace('/onboarding/avoid')}
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
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
