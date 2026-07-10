import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { deletePantryItem, listPantry, type PantryItem } from '../lib/pantry';
import { categoryOf, toSentenceCase } from '../lib/pantryCategories';
import { colors, spacing } from '../theme/tokens';

type Status = 'loading' | 'ready' | 'error';

/**
 * Pantry category detail (pushed route /pantry-category?category=…). Lists one
 * category's items with × remove. Adding stays on the main Pantry screen; no
 * move control yet (P3). Fetches via the same listPantry() and refetches on
 * focus, so removing here is reflected in the main counts on return.
 */
export default function PantryCategory() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = category ?? '';

  const [items, setItems] = useState<PantryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const rows = await listPantry();
          if (active) {
            setItems(rows);
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

  // Detail-only presentation: alphabetical A→Z, case/accent-insensitive. .filter
  // returns a fresh array, so sorting it does not mutate the source `items`.
  const catItems = items
    .filter((it) => categoryOf(it) === cat)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  async function remove(item: PantryItem) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id)); // optimistic
    setError(null);
    try {
      await deletePantryItem(item.id);
    } catch {
      setItems(prev); // rollback
      setError('Could not remove, try again');
    }
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">{toSentenceCase(cat)}</Text>

        {status === 'loading' ? (
          <Text variant="body" color="textSecondary">
            Loading
          </Text>
        ) : status === 'error' ? (
          <Text variant="body" color="textSecondary">
            Couldn&apos;t load your pantry
          </Text>
        ) : catItems.length === 0 ? (
          <Text variant="body" color="textSecondary">
            Nothing here yet
          </Text>
        ) : (
          <View style={styles.list}>
            {catItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text variant="body">{item.name}</Text>
                <Pressable
                  onPress={() => remove(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  hitSlop={8}
                  style={styles.remove}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {error ? <Text variant="body">{error}</Text> : null}
      </ScrollView>
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
    gap: spacing.lg,
  },
  list: {
    // Rows carry their own hairline separators; no inter-row gap.
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  remove: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
