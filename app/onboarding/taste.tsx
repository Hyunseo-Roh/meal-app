import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';
import { useOnboarding } from './_layout';

type Cuisine = { id: string; display_label: string; emoji: string };

// Page 1 of 3 — Taste. Favorite cuisines only — an unordered multi-select, max
// three, no rank. Nothing is saved here; selections live in the shared
// onboarding draft and are written once at the end of Page 3 (Constraints).
export default function TasteSetup() {
  const router = useRouter();
  const { favorites, setFavorites, setDisliked } = useOnboarding();

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    setStatus('loading');
    supabase
      .from('cuisines')
      .select('id, display_label, emoji')
      .order('display_label')
      .then(
        ({ data, error }) => {
          if (error || !data) {
            setStatus('error');
            return;
          }
          setCuisines(data as Cuisine[]);
          setStatus('ready');
        },
        () => setStatus('error'), // network throw (e.g. offline / blocked)
      );
  }, []);

  useEffect(() => load(), [load]);

  // Chosen favorites — an UNORDERED set, no cap. Tapping toggles a cuisine
  // in/out. Favorite and never-suggest (Page 2) are mutually exclusive —
  // picking a favorite clears it from the skip list. (Favorites score a flat
  // +30 each, rankless, so lifting the cap can't out-weight the other terms.)
  function pickFavorite(id: string) {
    setFavorites((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
    setDisliked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const canContinue = favorites.length > 0;

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
          <Text variant="display">What do you like to eat?</Text>
        </View>

        <View style={styles.section}>
          {status === 'loading' ? (
            <LoadingState message="Loading…" />
          ) : status === 'error' ? (
            <ErrorState message="Couldn't load cuisines. Try again." onRetry={load} />
          ) : (
            <>
              <Text variant="body" color="textSecondary">
                Pick as many as you like
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
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue"
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
