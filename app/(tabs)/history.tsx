import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDate } from '../../lib/format';
import { loadHistory, type HistoryEntry } from '../../lib/history';
import { colors, spacing } from '../../theme/tokens';

type Status = 'loading' | 'ready' | 'error';

export default function History() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  // Manual retry (from the error state).
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

  if (status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          Loading…
        </Text>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          Couldn&apos;t load your history.
        </Text>
        <Pressable onPress={load} accessibilityRole="button" style={styles.link}>
          <Text variant="body" color="accent">
            Try again
          </Text>
        </Pressable>
      </Screen>
    );
  }

  if (entries.length === 0) {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary" style={styles.emptyText}>
          Nothing here yet — the meals you make show up here.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
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
  emptyText: {
    textAlign: 'center',
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
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
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  // Meta is data, not a label — drop the caption role's uppercase + tracking
  // (same override as the recommendation cards' dataCaption).
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
});
