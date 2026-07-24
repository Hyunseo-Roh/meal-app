import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MealImage } from '../components/MealImage';
import { Screen } from '../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { Text } from '../components/Text';
import { formatDate, monthKey, monthLabel } from '../lib/format';
import { HISTORY_PAGE_SIZE, loadHistory, type HistoryEntry } from '../lib/history';
import { colors, spacing } from '../theme/tokens';

type Status = 'loading' | 'ready' | 'error';

// Consecutive entries (already newest-first) sharing a year+month, so each month
// renders its header once above its rows.
type MonthGroup = { key: string; label: string; items: HistoryEntry[] };

function groupByMonth(entries: HistoryEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const e of entries) {
    const key = monthKey(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, label: monthLabel(e.createdAt), items: [e] });
  }
  return groups;
}

/**
 * Full "meals you've made" list — grouped under month headers, newest first,
 * paged HISTORY_PAGE_SIZE at a time via loadHistory(offset). Reached from
 * Profile's inline preview via "See all". Reuses lib/history.ts as-is; no new
 * writes.
 */
export default function History() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  // Whether another page might exist (last fetch returned a full page).
  const [hasMore, setHasMore] = useState(false);
  // Paging in progress — drives the inline "Load more" label WITHOUT swapping
  // the whole list back to the full-screen loading state.
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // A full page back means there may be more; a short page is the end.
  const applyFirstPage = (rows: HistoryEntry[]) => {
    setEntries(rows);
    setHasMore(rows.length === HISTORY_PAGE_SIZE);
    setLoadMoreError(null);
  };

  // Explicit retry (from the error state): show the loading line while refetching.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      applyFirstPage(await loadHistory(0));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Silent refresh on focus — reset to the first page so a meal made this session
  // appears, without flashing "Loading…" over the list already on screen.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const rows = await loadHistory(0);
          if (active) {
            applyFirstPage(rows);
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

  // Append the next page. Never touches `status`, so the list stays visible.
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await loadHistory(entries.length);
      setEntries((prev) => [...prev, ...next]);
      setHasMore(next.length === HISTORY_PAGE_SIZE);
    } catch {
      // Keep hasMore true so the control stays and the user can retry.
      setLoadMoreError('Couldn’t load more. Try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="Gathering what you've made…" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.centered}>
        <ErrorState message="Your meals didn't come through" onRetry={load} />
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

  const groups = groupByMonth(entries);

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
        {groups.map((g) => (
          <View key={g.key} style={styles.group}>
            <Text variant="caption" color="textSecondary" style={styles.monthHeader}>
              {g.label}
            </Text>
            {g.items.map((e, i) => (
              <Pressable
                key={`${e.mealId}-${e.createdAt}-${i}`}
                onPress={() => router.push({ pathname: '/meal/[id]', params: { id: e.mealId } })}
                accessibilityRole="button"
                accessibilityLabel={`${e.name}, made ${formatDate(e.createdAt)}`}
                style={styles.itemRow}
              >
                <MealImage url={e.imageUrl} width={56} height={56} radius={8} />
                <View style={styles.itemText}>
                  <Text variant="body">{e.name}</Text>
                  <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                    {`${formatDate(e.createdAt)} · ${e.cuisineLabel}`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {hasMore ? (
          <View>
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              accessibilityRole="button"
              style={styles.loadMore}
            >
              <Text variant="body" color="accent">
                {loadingMore ? 'Loading…' : 'Load more'}
              </Text>
            </Pressable>
            {loadMoreError ? (
              <Text variant="body" color="textSecondary" style={styles.loadMoreError}>
                {loadMoreError}
              </Text>
            ) : null}
          </View>
        ) : null}
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
  // One month: its header, then its rows (rows carry their own hairlines).
  group: {
    // Header sits directly above its rows; the content gap separates groups.
  },
  // 13pt uppercase label, same treatment as PROTEINS / QUICK ADD, with room
  // below so it reads as a header over its rows rather than another row.
  monthHeader: {
    marginBottom: spacing.sm,
  },
  itemRow: {
    // Thumbnail left, text block right, both vertically centered.
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  // Name stacked above the date·cuisine caption; long names get a full line and
  // wrap within the column instead of colliding on the right edge.
  itemText: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  // Meta is data, not a label — drop the caption role's uppercase + tracking.
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  loadMore: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreError: {
    textAlign: 'center',
  },
});
