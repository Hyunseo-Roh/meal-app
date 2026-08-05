import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import {
  addPantryItem,
  deletePantryItem,
  listPantry,
  setPantryItemCategory,
  setPantryItemQuantity,
  type PantryItem,
} from '../../lib/pantry';
import { CATEGORY_ORDER, categoryOf, toSentenceCase } from '../../lib/pantryCategories';
import { colors, layout, spacing, typography } from '../../theme/tokens';

// How long the just-added row stays highlighted.
const ADDED_NOTICE_MS = 2500;

type Status = 'loading' | 'ready' | 'error';

// On react-native-web a bare drag element lets the browser own the gesture — a
// mobile finger scrolls (touch-action) and a desktop pointer selects the title
// text (user-select) — so the PanResponder is never granted and the drag does
// nothing. Suppressing both on the drag region hands the gesture back to us.
// No-op / ignored on native.
const dragRegionStyle =
  Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as object) : undefined;

/**
 * Makes a bottom sheet swipe-to-dismiss. RN's Modal has no built-in drag gesture,
 * so we drive a translateY with a PanResponder that captures only DOWNWARD drags
 * (dy > 4) and clamps upward motion at 0. Release past 25% of the sheet's height
 * or a fast flick (vy > 0.5) dismisses; anything shorter springs back.
 *
 * `panHandlers` must be spread onto the handle/heading region ONLY so rows inside
 * the sheet stay tappable, that region must also carry `dragRegionStyle` (web
 * touch-action fix, below), and `reset()` must run whenever the sheet reopens
 * (the value persists across the Modal's mount/unmount otherwise). The
 * capture-phase grab + refused termination keep the swipe from being stolen by
 * the browser mid-drag on react-native-web, so the mouse/touch drags the sheet
 * in the browser too; `onLayout` feeds the height used for the 25% threshold.
 */
function useDismissibleSheet(onDismiss: () => void) {
  const translateY = useRef(new Animated.Value(0)).current;
  const heightRef = useRef(0);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const reset = useCallback(() => translateY.setValue(0), [translateY]);
  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    heightRef.current = e.nativeEvent.layout.height;
  }, []);

  const springBack = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  }, [translateY]);

  const responder = useRef(
    PanResponder.create({
      // Claim the gesture on a downward drag on BOTH phases — mobile-web fires the
      // capture phase first, and the bubble phase covers native.
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 4,
      // Once we own the drag, don't let the browser's scroll steal it mid-swipe.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        const threshold = heightRef.current > 0 ? heightRef.current * 0.25 : 80;
        if (g.dy > threshold || g.vy > 0.5) {
          dismissRef.current();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: () => springBack(),
    }),
  ).current;

  return { translateY, panHandlers: responder.panHandlers, reset, onLayout };
}

export default function Pantry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  // The premium explainer popup (merged Barcode scan + AI Chef card → this).
  const [premiumOpen, setPremiumOpen] = useState(false);
  // Add-by-name is collapsed behind a "+" row at the bottom of the current list.
  const [addOpen, setAddOpen] = useState(false);
  // The item whose edit sheet is open (null = closed), plus a sheet-local error
  // and the move-to-category dropdown's open state.
  const [sheetItem, setSheetItem] = useState<PantryItem | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  // Which category the swipe row has selected — the list shows only its items.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // The just-added item id — highlights its row briefly. Transient.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  // Synchronous mirror of each item's quantity, so rapid stepper taps accumulate
  // (each tap reads the latest target, not a stale render closure).
  const qtyRef = useRef<Record<string, number>>({});
  // Per-item write chain: serialize quantity writes so rapid taps persist in
  // order (last value wins) instead of racing to an out-of-order final value.
  const qtyWriteChain = useRef<Record<string, Promise<unknown>>>({});

  // Swipe-to-dismiss for each bottom sheet (closeSheet/setPremiumOpen are hoisted).
  const editSheet = useDismissibleSheet(() => closeSheet());
  const premiumSheet = useDismissibleSheet(() => setPremiumOpen(false));
  useEffect(() => {
    if (sheetItem) editSheet.reset();
  }, [sheetItem, editSheet]);
  useEffect(() => {
    if (premiumOpen) premiumSheet.reset();
  }, [premiumOpen, premiumSheet]);

  // Manual retry (from the error state): show the loading line while refetching.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await listPantry();
      setItems(rows);
      qtyRef.current = Object.fromEntries(rows.map((i) => [i.id, i.quantity]));
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
            qtyRef.current = Object.fromEntries(rows.map((i) => [i.id, i.quantity]));
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

  // Retire the just-added highlight on its own (a fresh add clears the old timer).
  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), ADDED_NOTICE_MS);
    return () => clearTimeout(t);
  }, [justAddedId]);

  // Categories that currently hold at least one item, in display order, w/ counts.
  const catCounts = CATEGORY_ORDER.map((cat) => ({
    cat,
    count: items.filter((i) => categoryOf(i) === cat).length,
  })).filter((c) => c.count > 0);
  const presentKey = catCounts.map((c) => c.cat).join(',');

  // Default-select the first present category, and keep the selection valid as
  // categories come and go (add / remove / move). Runs only when the SET of
  // present categories changes, so it never fights a manual selection.
  useEffect(() => {
    if (catCounts.length === 0) {
      setSelectedCategory(null);
      return;
    }
    if (!catCounts.some((c) => c.cat === selectedCategory)) {
      setSelectedCategory(catCounts[0].cat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentKey]);

  const selectedItems = selectedCategory
    ? items
        .filter((i) => categoryOf(i) === selectedCategory)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    : [];

  const has = (name: string) => items.some((i) => i.name === name.trim().toLowerCase());

  // Add with NO explicit category: it stores NULL, so categoryOf() derives the
  // category from the ingredient NAME (categorize). An explicit category is a
  // user PIN, written only by a manual "move". After the insert, jump the view to
  // where the item actually landed — its derived category — so the add is visible.
  async function add(name: string) {
    const v = name.trim().toLowerCase();
    if (!v || adding || has(v)) return;
    setAdding(true);
    setError(null);
    try {
      const row = await addPantryItem(v);
      if (row) {
        setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
        qtyRef.current[row.id] = row.quantity;
        setJustAddedId(row.id);
        // Follow the item to its derived category (row.category is NULL here, so
        // categoryOf === categorize(name)) — the same key the list groups by.
        setSelectedCategory(categoryOf(row));
      }
    } catch {
      setError('That didn’t make it in');
    } finally {
      setAdding(false);
    }
  }

  async function addDraft() {
    const v = draft;
    setDraft('');
    await add(v);
  }

  // Quantity stepper. Optimistic; floors at 1; reverts on error. Never feeds the
  // recommendation engine — quantity is display/edit only.
  function changeQty(item: PantryItem, delta: number) {
    // Read the latest target from the ref (accumulates across rapid taps), floor
    // at 1, and write it back synchronously so a fast next tap sees it.
    const current = qtyRef.current[item.id] ?? item.quantity;
    const next = Math.max(1, current + delta);
    if (next === current) return;
    qtyRef.current[item.id] = next;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, quantity: next } : i)));
    setError(null);
    // Chain this write after any pending write for the same item, so the DB ends
    // up at the FINAL tapped value rather than whichever concurrent write lands
    // last. A failure surfaces a note; the next focus/reload reconciles to truth.
    const prev = qtyWriteChain.current[item.id] ?? Promise.resolve();
    qtyWriteChain.current[item.id] = prev
      .catch(() => {})
      .then(() => setPantryItemQuantity(item.id, qtyRef.current[item.id]))
      .catch(() => setError('That didn’t save'));
  }

  function openSheet(item: PantryItem) {
    setSheetError(null);
    setMoveOpen(false);
    setSheetItem(item);
  }
  function closeSheet() {
    setSheetItem(null);
    setSheetError(null);
    setMoveOpen(false);
  }

  // Move: write the new category (only labels from CATEGORY_ORDER reach here).
  // Optimistically re-tag in `items`; the item leaves one category and joins
  // another (the selector recounts) in the same frame.
  async function moveTo(item: PantryItem, target: string) {
    setSheetError(null);
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, category: target } : i)));
    setSelectedCategory(target); // follow the item so it stays visible
    try {
      await setPantryItemCategory(item.id, target);
      closeSheet();
    } catch {
      setItems(prev); // rollback
      setSheetError('That didn’t move');
    }
  }

  async function removeItem(item: PantryItem) {
    setSheetError(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id)); // optimistic
    if (justAddedId === item.id) setJustAddedId(null);
    try {
      await deletePantryItem(item.id);
      closeSheet();
    } catch {
      setItems(prev); // rollback
      setSheetError('That didn’t come off');
    }
  }

  const moveTargets = sheetItem
    ? CATEGORY_ORDER.filter((c) => c !== categoryOf(sheetItem))
    : [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              {/* A stocked-shelf glyph — distinct from the Pantry TAB's container
                  (cube) glyph, so the title and tab read as pantry without twinning. */}
              <Ionicons name="file-tray-stacked-outline" size={30} color={colors.textSecondary} />
            </View>
            <Text variant="title">Pantry</Text>
          </View>
          <Text variant="body" color="textSecondary">
            What&apos;s in your kitchen — Sate tracks the gaps.
          </Text>
        </View>

        {/* Premium — pinned near the top, unchanged. Tapping opens the explainer. */}
        <Pressable
          onPress={() => setPremiumOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Barcode scan and AI Chef — learn more"
          style={styles.premiumCard}
        >
          <View style={styles.premiumBody}>
            <View style={styles.badge}>
              <Text variant="caption" color="textSecondary">
                Premium
              </Text>
            </View>
            <Text variant="body">Barcode scan and AI Chef</Text>
            <Text variant="body" color="textSecondary">
              Conveniences on top of the free app
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        {status === 'loading' ? (
          <LoadingState message="Opening your pantry…" delayMs={250} />
        ) : status === 'error' ? (
          <ErrorState message="Your pantry didn't open" onRetry={load} />
        ) : (
          <>
            {/* CATEGORY SWIPE ROW — a horizontal, edge-to-edge card strip; one card
                per category that has items. Selected = Butter fill + Toast border. */}
            {catCounts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScroll}
                contentContainerStyle={styles.catRow}
              >
                {catCounts.map(({ cat, count }) => {
                  const selected = cat === selectedCategory;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      accessibilityRole="button"
                      accessibilityLabel={`${toSentenceCase(cat)}, ${count} items`}
                      style={[styles.catCard, selected && styles.catCardSelected]}
                    >
                      <Text variant="body" numberOfLines={1}>
                        {toSentenceCase(cat)}
                      </Text>
                      <Text variant="caption" color="textSecondary" style={styles.catCount}>
                        {`${count} item${count === 1 ? '' : 's'}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* ITEM LIST — only the selected category's items, each with a stepper. */}
            <View style={styles.section}>
              {items.length === 0 ? (
                <EmptyState message="Nothing here yet — add a staple below" />
              ) : (
                selectedItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => openSheet(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${item.name}`}
                      style={styles.itemName}
                    >
                      <Text variant="body" color={justAddedId === item.id ? 'accent' : 'text'}>
                        {toSentenceCase(item.name)}
                      </Text>
                    </Pressable>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => changeQty(item, -1)}
                        disabled={item.quantity <= 1}
                        accessibilityRole="button"
                        accessibilityLabel={`Fewer ${item.name}`}
                        hitSlop={8}
                        style={styles.stepBtn}
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color={item.quantity <= 1 ? colors.chipBorder : colors.text}
                        />
                      </Pressable>
                      <Text variant="title" color="toast" style={styles.qtyNum}>
                        {item.quantity}
                      </Text>
                      <Pressable
                        onPress={() => changeQty(item, 1)}
                        accessibilityRole="button"
                        accessibilityLabel={`More ${item.name}`}
                        hitSlop={8}
                        style={styles.stepBtn}
                      >
                        <Ionicons name="add" size={20} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              {/* + Add an item — at the bottom of the current category's list.
                  Adding writes the selected category so it appears right here. */}
              {addOpen ? (
                <View style={styles.addFields}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={addDraft}
                    placeholder="Type an item, press enter"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoFocus
                    returnKeyType="done"
                    style={styles.input}
                  />
                  <PrimaryButton label={adding ? 'Adding…' : 'Add'} onPress={addDraft} disabled={adding} />
                </View>
              ) : (
                <Pressable
                  onPress={() => setAddOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add an item by name"
                  style={styles.addToggle}
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                  <Text variant="body">Add an item</Text>
                </Pressable>
              )}
              {error ? <Text variant="body">{error}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* Edit sheet — Move via a select control + Remove. */}
      <Modal visible={sheetItem !== null} transparent animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={closeSheet} accessibilityLabel="Dismiss" />
          {sheetItem ? (
            <Animated.View
              onLayout={editSheet.onLayout}
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + spacing.lg },
                { transform: [{ translateY: editSheet.translateY }] },
              ]}
            >
              {/* Drag region — handle + title ONLY, so the controls below stay
                  tappable while a downward swipe on the top dismisses the sheet. */}
              <View {...editSheet.panHandlers} style={dragRegionStyle}>
                <View style={styles.dragHandle} />
                <Text variant="title" style={styles.sheetTitle}>
                  {toSentenceCase(sheetItem.name)}
                </Text>
              </View>

              {/* Move to category — a single select control that opens a dropdown. */}
              <Text variant="caption" color="textSecondary" style={styles.moveToLabel}>
                Move to category
              </Text>
              <Pressable
                onPress={() => setMoveOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityLabel="Choose a category"
                style={styles.selectControl}
              >
                <Text variant="body" color="textSecondary">
                  {toSentenceCase(categoryOf(sheetItem))}
                </Text>
                <Ionicons
                  name={moveOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
              {moveOpen ? (
                <View style={styles.selectMenu}>
                  {moveTargets.map((target) => (
                    <Pressable
                      key={target}
                      onPress={() => moveTo(sheetItem, target)}
                      accessibilityRole="button"
                      style={styles.selectOption}
                    >
                      <Text variant="body">{toSentenceCase(target)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

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
            </Animated.View>
          ) : null}
        </View>
      </Modal>

      {/* Premium explainer — unchanged. */}
      <Modal
        visible={premiumOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPremiumOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.scrim}
            onPress={() => setPremiumOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <Animated.View
            onLayout={premiumSheet.onLayout}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg },
              { transform: [{ translateY: premiumSheet.translateY }] },
            ]}
          >
            <View {...premiumSheet.panHandlers} style={dragRegionStyle}>
              <View style={styles.dragHandle} />
              <Text variant="title" style={styles.sheetTitle}>
                With Premium
              </Text>
            </View>
            <Text variant="body" color="textSecondary">
              You&apos;ve got what you need for free — these two just save steps
            </Text>

            <Pressable
              onPress={() => {
                setPremiumOpen(false);
                router.push('/scanner');
              }}
              accessibilityRole="button"
              accessibilityLabel="Open barcode scanner"
              style={styles.premiumFeatureRow}
            >
              <View style={styles.premiumFeatureBody}>
                <Text variant="body">Barcode scan</Text>
                <Text variant="body" color="textSecondary">
                  Scan a barcode to fill your pantry — no typing
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.premiumFeatureRow}>
              <View style={styles.premiumFeatureBody}>
                <Text variant="body">AI Chef</Text>
                <Text variant="body" color="textSecondary">
                  Pick what&apos;s left in your fridge and get recipes that use it up
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setPremiumOpen(false);
                router.push('/subscription');
              }}
              accessibilityRole="button"
              accessibilityLabel="See Premium"
              style={styles.premiumFeatureRow}
            >
              <View style={styles.premiumFeatureBody}>
                <Text variant="body">See Premium</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>

            <PrimaryButton label="Got it" onPress={() => setPremiumOpen(false)} />
          </Animated.View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.md,
  },
  // Category strip breaks out of the screen's 24px side margins so cards can be
  // cut by the screen edge (the peek), while the first card still aligns to the
  // content column via the contentContainer's padding.
  catScroll: {
    marginHorizontal: -layout.screenMargin,
  },
  catRow: {
    paddingHorizontal: layout.screenMargin,
    gap: spacing.sm,
  },
  catCard: {
    width: 116,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    backgroundColor: colors.card,
    gap: spacing.xs,
  },
  // Selected: Butter fill + Toast border (the selection accent).
  catCardSelected: {
    backgroundColor: colors.butter,
    borderColor: colors.toast,
  },
  catCount: {
    textTransform: 'none',
    letterSpacing: 0,
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
  addFields: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
  },
  // Item row: name (tappable → sheet) left, quantity stepper right, hairline below.
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  itemName: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Literata 24 Toast numeral — fixed width so the buttons don't shift 1↔10.
  qtyNum: {
    minWidth: 28,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chipBorder,
    marginBottom: spacing.sm,
  },
  premiumFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  premiumFeatureBody: {
    flex: 1,
    gap: spacing.xs,
  },
  sheetTitle: {
    marginBottom: spacing.sm,
  },
  moveToLabel: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  // The collapsed select control (a bordered row with a chevron).
  selectControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    backgroundColor: colors.card,
  },
  // The dropdown options revealed under the control.
  selectMenu: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  selectOption: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
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
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  premiumBody: {
    flex: 1,
    gap: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
