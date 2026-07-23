import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { Text } from '../components/Text';
import { formatDate } from '../lib/format';
import { loadHistory, type HistoryEntry } from '../lib/history';
import { colors, spacing } from '../theme/tokens';

type Status = 'loading' | 'ready' | 'error';

/**
 * Full "meals you've made" list. Reached from Profile's inline preview via
 * "See all" — a pushed (non-tab) route, so it carries its own back affordance.
 * Reuses lib/history.ts as-is; no new writes, no image treatment (polish later).
 */
export default function History() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setEntries(await loadHistory());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Refetch on focus so a meal made this session appears when the user returns.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const rows = await loadHistory();
          if (active) {
            setEntries(rows);
            setStatus('ready');
          }
        } catch {
          if (active) setStatus('error');
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="Loading…" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.centered}>
        <ErrorState message="Couldn't load your history." onRetry={load} />
      </Screen>
    );
  }

  if (entries.length === 0) {
    return (
      <Screen style={styles.centered}>
        <EmptyState centered message="Nothing yet — pick a meal and it lands here" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={back}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">History</Text>
        <View style={styles.list}>
          {entries.map((e, i) => (
            <Pressable
              key={`${e.mealId}-${e.createdAt}-${i}`}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: e.mealId } })}
              accessibilityRole="button"
              accessibilityLabel={`${e.name}, made ${formatDate(e.createdAt)}`}
              style={styles.itemRow}
            >
              <Text variant="body">{e.name}</Text>
              <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                {`${formatDate(e.createdAt)} · ${e.cuisineLabel}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  backArrow: {
    paddingTop: spacing.sm,
    marginLeft: -spacing.xs,
    alignSelf: 'flex-start',
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  list: {
    // Rows carry their own hairline separators; no inter-row gap.
  },
  itemRow: {
    // Stacked (not space-between): long meal names get their own full-width line
    // above the date·cuisine caption, so nothing collides on the right edge.
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  // Meta is data, not a label — drop the caption role's uppercase + tracking.
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
});
