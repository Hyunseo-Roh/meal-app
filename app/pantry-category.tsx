import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import {
  deletePantryItem,
  listPantry,
  setPantryItemCategory,
  type PantryItem,
} from '../lib/pantry';
import { CATEGORY_ORDER, categoryOf, toSentenceCase } from '../lib/pantryCategories';
import { colors, spacing } from '../theme/tokens';

type Status = 'loading' | 'ready' | 'error';

/**
 * Pantry category detail (pushed route /pantry-category?category=…). Lists one
 * category's items; tapping an item opens a move sheet (change category, or
 * remove). Moving writes pantry_items.category via setPantryItemCategory, so the
 * item leaves this list and the target's count rises. Adding stays on the main
 * Pantry screen. Refetches on focus, so changes reflect in the main counts.
 */
export default function PantryCategory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = category ?? '';

  const [items, setItems] = useState<PantryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  // The item whose move sheet is open (null = closed), plus a sheet-local error.
  const [sheetItem, setSheetItem] = useState<PantryItem | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

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

  function openSheet(item: PantryItem) {
    setSheetError(null);
    setSheetItem(item);
  }
  function closeSheet() {
    setSheetItem(null);
    setSheetError(null);
  }

  // Move: write the new category (only labels from CATEGORY_ORDER reach here).
  // Optimistically re-tag locally so the item leaves this category's list.
  async function moveTo(item: PantryItem, target: string) {
    setSheetError(null);
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, category: target } : i)));
    try {
      await setPantryItemCategory(item.id, target);
      closeSheet();
    } catch {
      setItems(prev); // rollback
      setSheetError('Could not move, try again');
    }
  }

  async function removeItem(item: PantryItem) {
    setSheetError(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id)); // optimistic
    try {
      await deletePantryItem(item.id);
      closeSheet();
    } catch {
      setItems(prev); // rollback
      setSheetError('Could not remove, try again');
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
              <Pressable
                key={item.id}
                onPress={() => openSheet(item)}
                accessibilityRole="button"
                accessibilityLabel={`Options for ${item.name}`}
                style={styles.itemRow}
              >
                <Text variant="body">{item.name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={sheetItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={closeSheet} accessibilityLabel="Dismiss" />
          {sheetItem ? (
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Text variant="title" style={styles.sheetTitle}>
                {sheetItem.name}
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.moveToLabel}>
                Move to
              </Text>
              <View>
                {CATEGORY_ORDER.filter((c) => c !== cat).map((target) => (
                  <Pressable
                    key={target}
                    onPress={() => moveTo(sheetItem, target)}
                    accessibilityRole="button"
                    style={styles.sheetRow}
                  >
                    <Text variant="body">{toSentenceCase(target)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => removeItem(sheetItem)}
                accessibilityRole="button"
                style={[styles.sheetRow, styles.removeRow]}
              >
                <Text variant="body">Remove</Text>
              </Pressable>
              {sheetError ? <Text variant="body">{sheetError}</Text> : null}
              <Pressable onPress={closeSheet} accessibilityRole="button" style={styles.sheetRow}>
                <Text variant="body" color="textSecondary">
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Charcoal token at low opacity — no new color. Separate view so its opacity
  // never dims the sheet.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.4,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    // 8 here + the sheet's 8 gap = ~16 of separation, so the 24 title reads as
    // its own block above the eyebrow (the eyebrow→first row stays the 8 gap).
    marginBottom: spacing.sm,
  },
  moveToLabel: {
    // Quiet eyebrow: 13 / secondary, sentence case — drop the caption role's
    // uppercase + tracking (same treatment as the pantry category labels).
    textTransform: 'none',
    letterSpacing: 0,
  },
  sheetRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  removeRow: {
    borderTopWidth: 1,
    borderTopColor: colors.chipBorder,
    marginTop: spacing.sm,
  },
});
