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
  type PantryItem,
} from '../../lib/pantry';
import { CATEGORY_ORDER, categoryOf, toSentenceCase } from '../../lib/pantryCategories';
import { isPremiumActive } from '../../lib/session';
import { colors, spacing, typography } from '../../theme/tokens';

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
  // Client-only plan (non-reactive module boolean) — re-read on focus below so the
  // top card flips from upsell to a direct scanner entry after upgrading. Premium's
  // only working tool is the barcode scanner, and this tab is its sole entry point.
  const [premium, setPremium] = useState(isPremiumActive());
  // The centered add-item dialog. Its card centers in the space ABOVE the soft
  // keyboard (kbHeight below), so the input never hides behind it and there's no
  // floaty dead gap — a bottom sheet would be covered by the keyboard instead.
  const [addModalOpen, setAddModalOpen] = useState(false);
  // Soft-keyboard height (web) while the add dialog is open, measured from
  // visualViewport. Applied as bottom padding on the modal root so the card
  // centers in the remaining visible area. Modal-scoped; stays 0 on native.
  const [kbHeight, setKbHeight] = useState(0);
  // The item whose edit sheet is open (null = closed), plus a sheet-local error
  // and the move-to-category dropdown's open state.
  const [sheetItem, setSheetItem] = useState<PantryItem | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  // The just-added item id — highlights its row briefly. Transient.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Swipe-to-dismiss for each bottom sheet (closeSheet/setPremiumOpen are hoisted).
  const editSheet = useDismissibleSheet(() => closeSheet());
  const premiumSheet = useDismissibleSheet(() => setPremiumOpen(false));
  useEffect(() => {
    if (sheetItem) editSheet.reset();
  }, [sheetItem, editSheet]);
  useEffect(() => {
    if (premiumOpen) premiumSheet.reset();
  }, [premiumOpen, premiumSheet]);

  // Track the soft-keyboard height ONLY while the add dialog is open (web). When
  // the keyboard opens, visualViewport shrinks; innerHeight − viewport.height −
  // offsetTop is the covered height. Feeding it into the modal root's bottom
  // padding centers the card in the visible area above the keyboard. The listener
  // is added on open and torn down (with kbHeight reset) on close. Native/no
  // visualViewport: the effect returns early and kbHeight stays 0.
  useEffect(() => {
    if (!addModalOpen) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    onResize();
    vv.addEventListener('resize', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      setKbHeight(0);
    };
  }, [addModalOpen]);

  // Manual retry (from the error state): show the loading line while refetching.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await listPantry();
      setItems(rows);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Silent refresh on focus — keep showing current items, never flash "Loading…".
  useFocusEffect(
    useCallback(() => {
      // Re-read the plan on return (e.g. after upgrading via Profile → subscription).
      setPremium(isPremiumActive());
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

  // Retire the just-added highlight on its own (a fresh add clears the old timer).
  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), ADDED_NOTICE_MS);
    return () => clearTimeout(t);
  }, [justAddedId]);

  // Vertical sections: every non-empty category in CATEGORY_ORDER, its items
  // sorted by name (case-insensitive). Grouping key is categoryOf (stored
  // override ?? name heuristic). The whole pantry renders at once — no tab to
  // reveal a slice, no horizontal clipping.
  const sections = CATEGORY_ORDER.map((cat) => ({
    cat,
    catItems: items
      .filter((i) => categoryOf(i) === cat)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  })).filter((s) => s.catItems.length > 0);

  const has = (name: string) => items.some((i) => i.name === name.trim().toLowerCase());

  // Add with NO explicit category: it stores NULL, so categoryOf() derives the
  // category from the ingredient NAME (categorize). An explicit category is a
  // user PIN, written only by a manual "move". The new item appears under its
  // auto section; the justAdded accent shows where it landed.
  async function add(name: string) {
    const v = name.trim().toLowerCase();
    if (!v || adding || has(v)) return;
    setAdding(true);
    setError(null);
    try {
      const row = await addPantryItem(v);
      if (row) {
        setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
        setJustAddedId(row.id);
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

  const closeAdd = () => {
    setAddModalOpen(false);
    setDraft('');
  };

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
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl }]}
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
            What&apos;s in your kitchen. Sate uses it to fill the gaps in each recipe.
          </Text>
        </View>

        {/* Top card — premium-aware, both branches open the SAME explainer sheet
            (which itself branches on `premium`). Free: an upsell. Premium: a
            plan-status card. Same footprint, so the top area stays stable. */}
        {premium ? (
          <Pressable
            onPress={() => setPremiumOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Your premium features"
            style={styles.premiumCard}
          >
            <View style={styles.premiumBody}>
              <View style={[styles.badge, styles.badgeOwned]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.have} />
                <Text variant="caption" color="textSecondary">
                  Premium
                </Text>
              </View>
              <Text variant="body">Your premium features</Text>
              <Text variant="body" color="textSecondary">
                Barcode scan is ready. AI Chef and monthly summary are coming soon.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : (
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
                Fill your pantry by scanning, and cook from leftovers.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        )}

        {status === 'loading' ? (
          <LoadingState message="Opening your pantry…" delayMs={250} />
        ) : status === 'error' ? (
          <ErrorState message="Your pantry didn't open" onRetry={load} />
        ) : (
          <View style={styles.body}>
            {/* VERTICAL SECTIONS — every non-empty category as a quiet header with
                its items stacked under it; the whole pantry in one scroll. */}
            {items.length === 0 ? (
              <EmptyState message="Nothing here yet — add a staple below" />
            ) : (
              sections.map(({ cat, catItems }) => (
                <View key={cat} style={styles.categoryBox}>
                  {/* Butter header band: text-only "CATEGORY · N" caption. The band
                      separates header from items, so no hairline; the box's rounded
                      border + overflow:hidden clip the band's corners. */}
                  <View style={styles.categoryHeader}>
                    <Text variant="caption" color="textSecondary">
                      {`${cat} · ${catItems.length}`}
                    </Text>
                  </View>
                  {catItems.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemRow,
                        idx === catItems.length - 1 && styles.itemRowLast,
                      ]}
                    >
                      {/* Name is plain text (not the tap target); the trailing ⋯
                          button is the explicit, discoverable entry to the sheet. */}
                      <Text
                        variant="body"
                        color={justAddedId === item.id ? 'accent' : 'text'}
                        numberOfLines={1}
                        style={styles.itemName}
                      >
                        {toSentenceCase(item.name)}
                      </Text>
                      {/* Overflow → the Move / Remove / Cancel sheet (unchanged). */}
                      <Pressable
                        onPress={() => openSheet(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Options for ${item.name}`}
                        hitSlop={8}
                        style={styles.overflowBtn}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}

            {/* + Add an item — at the BOTTOM, after every section. Opens a centered
                dialog; the added item is auto-categorized by name (stores NULL), so it
                appears under its own section with the justAdded accent. */}
            <Pressable
              onPress={() => setAddModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add an item by name"
              style={styles.addToggle}
            >
              <Ionicons name="add" size={20} color={colors.text} />
              <Text variant="body">Add an item</Text>
            </Pressable>
          </View>
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

      {/* Premium explainer — premium-aware. Free: a two-feature upsell with a
          "See Premium" link. Premium: the full plan with honest statuses (barcode
          ready, AI Chef + monthly summary coming soon) and no upsell link. */}
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
                {premium ? "You're on Premium" : 'With Premium'}
              </Text>
            </View>

            {premium ? (
              <>
                <Text variant="body" color="textSecondary">
                  Barcode scan is ready to use. AI Chef and monthly summary are on the way.
                </Text>

                {/* The one working feature — a primary action, not a list row. */}
                <PrimaryButton
                  label="Scan a barcode"
                  onPress={() => {
                    setPremiumOpen(false);
                    router.push('/scanner');
                  }}
                />

                <Text variant="caption" color="textSecondary" style={styles.alsoLabel}>
                  Also in your plan
                </Text>

                {/* AI Chef — not built yet: muted row, "Coming soon", no affordance. */}
                <View style={styles.premiumFeatureRow}>
                  <View style={styles.premiumFeatureBody}>
                    <View style={styles.soonTitleRow}>
                      <Text variant="body" color="textSecondary">
                        AI Chef
                      </Text>
                      <Text variant="caption" color="textSecondary" style={styles.soonLabel}>
                        Coming soon
                      </Text>
                    </View>
                    <Text variant="body" color="textSecondary">
                      Pick what&apos;s left in your fridge and get recipes that use it up
                    </Text>
                  </View>
                </View>

                {/* Monthly summary — same muted coming-soon row. */}
                <View style={styles.premiumFeatureRow}>
                  <View style={styles.premiumFeatureBody}>
                    <View style={styles.soonTitleRow}>
                      <Text variant="body" color="textSecondary">
                        Monthly summary
                      </Text>
                      <Text variant="caption" color="textSecondary" style={styles.soonLabel}>
                        Coming soon
                      </Text>
                    </View>
                    <Text variant="body" color="textSecondary">
                      A look back at your month
                    </Text>
                  </View>
                </View>

                {/* Ghost close — not a second Charcoal button. */}
                <Pressable
                  onPress={() => setPremiumOpen(false)}
                  accessibilityRole="button"
                  style={styles.ghostButton}
                >
                  <Text variant="body" color="textSecondary">
                    Close
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text variant="body" color="textSecondary">
                  Scan to fill your pantry, cook from leftovers, and see your month at a glance.
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

                {/* Monthly summary — descriptive, non-actionable. */}
                <View style={styles.premiumFeatureRow}>
                  <View style={styles.premiumFeatureBody}>
                    <Text variant="body">Monthly summary</Text>
                    <Text variant="body" color="textSecondary">
                      A look back at your month
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
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Add-item dialog — CENTERED and positioned HIGH (justify flex-start + a top
          margin) so the input sits above the web soft keyboard. A bottom sheet would
          be covered by the keyboard exactly like the old inline input. No pan hook. */}
      <Modal visible={addModalOpen} transparent animationType="fade" onRequestClose={closeAdd}>
        <View style={[styles.addModalRoot, { paddingBottom: kbHeight }]}>
          <Pressable style={styles.scrim} onPress={closeAdd} accessibilityLabel="Dismiss" />
          <View style={styles.addCard}>
            <Text variant="title">Add an item</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addDraft}
              placeholder="Type an item"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoFocus
              returnKeyType="done"
              style={styles.input}
            />
            {error ? <Text variant="body">{error}</Text> : null}
            <View style={styles.addButtonRow}>
              <Pressable onPress={closeAdd} accessibilityRole="button" style={styles.ghostButton}>
                <Text variant="body" color="textSecondary">
                  Cancel
                </Text>
              </Pressable>
              <View style={styles.addPrimaryWrap}>
                <PrimaryButton
                  label={adding ? 'Adding…' : 'Add'}
                  onPress={addDraft}
                  disabled={adding}
                />
              </View>
            </View>
          </View>
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
  // Shared header layout (matches Home/Profile): icon + serif title. The icon box
  // is the glyph's size (not a wider 44px box) so it sits flush at the 24px
  // content margin instead of indented by the box's centring slack.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The list body: category sections (and the add area) spaced generously apart,
  // matching the Profile settings rhythm.
  body: {
    gap: spacing.xl,
  },
  // Category card box — Greige surface, 12px radius, hairline border; overflow
  // hidden so the Butter header band's top corners clip to the radius.
  categoryBox: {
    backgroundColor: colors.card,
    borderRadius: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.chipBorder,
    overflow: 'hidden',
  },
  // Butter header band — icon + "CATEGORY · N" caption, full width across the box top.
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.butter,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text,
    height: 52,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    backgroundColor: colors.card,
  },
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
  },
  // Item row: name left, ⋯ overflow (→ sheet) right. Inside the box now, so it
  // carries its own horizontal padding; interior rows keep a divider.
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  // Last row in a box: the box border closes it, so drop the divider.
  itemRowLast: {
    borderBottomWidth: 0,
  },
  // Name takes the remaining width (truncates at one line); it's plain text now.
  itemName: {
    flex: 1,
  },
  // Trailing overflow control — a 32px tap target after the stepper, small left
  // margin so it doesn't crowd the "+" button.
  overflowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Add dialog root — centered horizontally, anchored HIGH (flex-start) so the card's
  // input sits above the web soft keyboard instead of behind it.
  // Centers the card in the visible area; a bottom padding equal to the soft
  // keyboard height (set inline) shrinks that area to the space above the keyboard.
  addModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Centered add card — Greige surface. Content stacked with a gap; the scrim
  // sibling handles dismiss.
  addCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Ghost Cancel — sizes to its label; the primary Add fills the rest of the row.
  ghostButton: {
    height: 52,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPrimaryWrap: {
    flex: 1,
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
  // Title line for a coming-soon feature: title left, "Coming soon" pushed to the
  // right edge (mirrors components/PremiumFeatureList.tsx so both read identically).
  soonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soonLabel: {
    marginLeft: 'auto',
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
  // Premium (owned) badge — a row so the checkmark sits before "Premium".
  badgeOwned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Eyebrow before the coming-soon group in the premium sheet; a little top
  // breathing room to separate it from the "Scan a barcode" action above.
  alsoLabel: {
    marginTop: spacing.sm,
  },
});
