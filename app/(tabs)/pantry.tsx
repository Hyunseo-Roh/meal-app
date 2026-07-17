import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import {
  addPantryItem,
  deletePantryItem,
  listPantry,
  setPantryItemCategory,
  type PantryItem,
} from '../../lib/pantry';
import { CATEGORY_ORDER, categoryOf, toSentenceCase } from '../../lib/pantryCategories';
import { colors, spacing, typography } from '../../theme/tokens';

// Local staple list (decoupled — not imported from the onboarding pantry screen).
const QUICK_ADD = ['rice', 'pasta', 'eggs', 'olive oil', 'garlic', 'onion', 'shrimp', 'chicken'];

// Non-functional premium placeholders. No entitlement check — pure UI.
const PREMIUM = [
  { key: 'scan', title: 'Barcode scan', subtitle: 'Skip the typing — scan to fill your pantry.' },
  { key: 'ai', title: 'AI Chef', subtitle: "Turn what's in your pantry into new recipes." },
] as const;

type Status = 'loading' | 'ready' | 'error';

export default function Pantry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [tappedPremium, setTappedPremium] = useState<string | null>(null);
  // The item whose move sheet is open (null = closed), plus a sheet-local error.
  const [sheetItem, setSheetItem] = useState<PantryItem | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Manual retry (from the error state): show the loading line while refetching.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setItems(await listPantry());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Silent refresh on focus — keep showing current items, never flash "Loading…".
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

  const has = (name: string) => items.some((i) => i.name === name.trim().toLowerCase());

  async function add(name: string) {
    const v = name.trim().toLowerCase();
    if (!v || adding || has(v)) return;
    setAdding(true);
    setError(null);
    try {
      const row = await addPantryItem(v);
      if (row) setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
    } catch {
      setError('Couldn’t add that. Try again.');
    } finally {
      setAdding(false);
    }
  }

  async function addDraft() {
    const v = draft;
    setDraft('');
    await add(v);
  }

  function openSheet(item: PantryItem) {
    setSheetError(null);
    setSheetItem(item);
  }
  function closeSheet() {
    setSheetItem(null);
    setSheetError(null);
  }

  // Move: write the new category (only labels from CATEGORY_ORDER reach here).
  // Optimistically re-tag in the shared `items`, so the item leaves one category
  // group and joins another — and both headers recount — in the same frame.
  async function moveTo(item: PantryItem, target: string) {
    setSheetError(null);
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, category: target } : i)));
    try {
      await setPantryItemCategory(item.id, target);
      closeSheet();
    } catch {
      setItems(prev); // rollback
      setSheetError('Couldn’t move that. Try again.');
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
      setSheetError('Couldn’t remove that. Try again.');
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="title">Pantry</Text>
          <Text variant="body" color="textSecondary">
            What&apos;s in your kitchen — Sate tracks the gaps.
          </Text>
        </View>

        {/* Add by name */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Add an item
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            placeholder="Type an item, press enter"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            returnKeyType="done"
            style={styles.input}
          />
          <PrimaryButton label={adding ? 'Adding…' : 'Add'} onPress={addDraft} disabled={adding} />
        </View>

        {/* Quick add — ADD-ONLY. Already-added staples render dimmed + non-interactive. */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Quick add
          </Text>
          <View style={styles.chipRow}>
            {QUICK_ADD.map((name) =>
              has(name) ? (
                <View key={name} style={styles.dim} pointerEvents="none">
                  <Chip label={name} selected={false} onPress={() => {}} />
                </View>
              ) : (
                <Chip key={name} label={name} selected={false} onPress={() => add(name)} />
              ),
            )}
          </View>
        </View>

        {/* Current pantry — removal is the ONLY delete path (tap the × chip).
            Header intentionally omitted: the intro copy + tab name set the zone,
            and a hairline divider marks the shift from the "add" zone. */}
        <View style={[styles.section, styles.pantryZone]}>
          {status === 'loading' ? (
            <Text variant="body" color="textSecondary">
              Loading…
            </Text>
          ) : status === 'error' ? (
            <View style={styles.errorRow}>
              <Text variant="body" color="textSecondary">
                Couldn&apos;t load your pantry.
              </Text>
              <Pressable onPress={load} accessibilityRole="button" style={styles.link}>
                <Text variant="body" color="accent">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <Text variant="body" color="textSecondary">
              Nothing here yet — add a staple above.
            </Text>
          ) : (
            // Everything inline: each non-empty category renders its header and
            // ALL its items. No detail page, no accordion — you scroll and see
            // the whole pantry. Tapping an item opens the move/remove sheet.
            CATEGORY_ORDER.map((cat) => {
              // .filter returns a fresh array, so sorting it never mutates `items`.
              const catItems = items
                .filter((it) => categoryOf(it) === cat)
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
              if (catItems.length === 0) return null;
              return (
                <View key={cat} style={styles.categoryGroup}>
                  <Text variant="caption" color="textSecondary">
                    {toSentenceCase(cat)}
                  </Text>
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
              );
            })
          )}
        </View>

        {error ? <Text variant="body">{error}</Text> : null}

        {/* Premium placeholders — non-functional, no entitlement check. */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            More, with Premium
          </Text>
          {PREMIUM.map((card) => (
            <Pressable
              key={card.key}
              onPress={() =>
                card.key === 'scan' ? router.push('/scanner') : setTappedPremium(card.key)
              }
              accessibilityRole="button"
              style={styles.premiumCard}
            >
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} style={styles.lock} />
              <View style={styles.premiumBody}>
                <View style={styles.premiumTitleRow}>
                  <Text variant="body">{card.title}</Text>
                  <View style={styles.badge}>
                    <Text variant="caption" color="textSecondary">
                      Premium
                    </Text>
                  </View>
                </View>
                <Text variant="body" color="textSecondary">
                  {card.subtitle}
                </Text>
                {tappedPremium === card.key ? (
                  <Text variant="body" color="textSecondary">
                    Coming soon
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
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
                {/* Targets exclude THIS item's own category — derived per item now
                    that one screen hosts every category at once. */}
                {CATEGORY_ORDER.filter((c) => c !== categoryOf(sheetItem)).map((target) => (
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
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
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
  // Hairline divider + breathing room marking the start of the "your pantry"
  // zone now that the header is gone.
  pantryZone: {
    borderTopWidth: 1,
    borderTopColor: colors.chipBorder,
    paddingTop: spacing.xl,
  },
  // One inline category: its caption header, then its item rows. The gap sits
  // between header and rows; the rows carry their own hairline separators.
  categoryGroup: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dim: {
    opacity: 0.4,
  },
  errorRow: {
    gap: spacing.sm,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  premiumCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  lock: {
    marginTop: spacing.xs,
  },
  premiumBody: {
    flex: 1,
    gap: spacing.xs,
  },
  premiumTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
