import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealImage } from '../../components/MealImage';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useSessionGate } from '../../components/RequireSession';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { loadGap, type GapData } from '../../lib/gap';
import { addPantryItem } from '../../lib/pantry';
import { colors, layout, spacing } from '../../theme/tokens';

// Bare procedural headers that carry no information. "For X:" is deliberately
// NOT in this list — it marks a sub-recipe ("For Peanut Sauce:") and must survive.
const HEADER = 'Method|Directions|Instructions|Preparation';

// Steps longer than this get a "Show all N steps" toggle; at/below it, all render.
const STEP_THRESHOLD = 10;
const STEP_CAP = 8;

// Price bucket from est_cost — same rule as the Home cards (P1).
function priceBucket(cost: number): string {
  if (cost <= 5) return '$5 & under';
  if (cost <= 10) return '$10 & under';
  return 'Over $10';
}

/**
 * Display-only cleanup of Spoonacular's raw step text — NEVER written back to
 * the DB. Their stored strings collapse sentence boundaries ("onions.For Peanut
 * Sauce:Method:Bring...") and carry orphan headers. Audited over all 46 seeded
 * meals / 326 steps: 52 altered, 0 bad splits, 0 "For X:" headers lost.
 */
function normalizeStep(s: string): string {
  return (
    s
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      .replace(/([a-z]):([A-Z])/g, '$1: $2')
      .replace(new RegExp(`^(?:(?:For\\s[^:]{1,40}|${HEADER})\\s*:\\s*)+`, 'i'), '')
      .replace(new RegExp(`(^|[.:]\\s*)(?:${HEADER})\\s*:\\s*`, 'g'), '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; gap: GapData }
  | { status: 'error' };

type Tab = 'ingredients' | 'howto';

export default function MealDetail() {
  const gate = useSessionGate();
  const { id, option_id } = useLocalSearchParams<{ id: string; option_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  // Optimistic overlay: names moved have←toBuy by tapping "+", plus an in-flight
  // guard and a subtle error. These sit on top of the RPC's gap (read-only).
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [pantryError, setPantryError] = useState<string | null>(null);
  // Steps collapse — local only, resets per meal. Nothing persisted.
  const [expanded, setExpanded] = useState(false);
  // Which tab is showing. Ingredients is the default/active.
  const [tab, setTab] = useState<Tab>('ingredients');

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    try {
      const gap = await loadGap(id);
      setState({ status: 'ready', gap });
    } catch {
      setState({ status: 'error' });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Reconcile with the RPC on every fresh load (mount/retry): reset the overlay,
  // since a just-added item now comes back inside gap.have. No duplicate/flicker.
  useEffect(() => {
    if (state.status === 'ready') {
      setAdded(new Set());
      setAdding(new Set());
      setPantryError(null);
    }
  }, [state]);

  async function addToPantry(name: string) {
    if (adding.has(name) || added.has(name)) return; // guard double-tap / already moved
    setAdding((s) => new Set(s).add(name));
    setAdded((s) => new Set(s).add(name)); // optimistic: toBuy → have
    setPantryError(null);
    try {
      await addPantryItem(name); // lowercases/trims internally
    } catch {
      setAdded((s) => {
        const n = new Set(s);
        n.delete(name);
        return n;
      });
      setPantryError('That didn’t make it in');
    } finally {
      setAdding((s) => {
        const n = new Set(s);
        n.delete(name);
        return n;
      });
    }
  }

  // Logged out (or unknown session) — redirect to Welcome before any data state.
  if (gate) return gate;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (state.status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="Checking your pantry…" delayMs={250} />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen style={styles.centered}>
        <ErrorState title="Couldn't open this" message="The details didn't come through" onRetry={load} />
      </Screen>
    );
  }

  const { gap } = state;
  // Apply the optimistic overlay on top of the RPC lists.
  const displayedToBuy = gap.toBuy.filter((n) => !added.has(n));
  const displayedHave = [...gap.have, ...gap.toBuy.filter((n) => added.has(n))];
  const haveCount = gap.have.length + added.size;

  // Steps: normalize for display. A one-step recipe shows; a meal with NO steps
  // shows a one-line note instead of silently vanishing.
  const steps = (gap.instructions ?? []).map(normalizeStep).filter(Boolean);
  const collapsible = steps.length > STEP_THRESHOLD;
  const visibleSteps = collapsible && !expanded ? steps.slice(0, STEP_CAP) : steps;

  return (
    // Screen owns left/right/bottom insets; the header below owns the TOP inset
    // so the hero no longer touches the notch and the back button seats in it.
    <Screen edges={['left', 'right', 'bottom']}>
      <View style={styles.flex}>
        {/* Top header bar — seated in the top safe-area inset (Bone bg so nothing
            is clipped), holding only the back button. Sits ABOVE the hero and
            stays put while the content scrolls. */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={styles.headerBack}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
        >
          {/* [0] Hero photo — full-bleed, Greige fallback. Starts BELOW the header. */}
          <View style={styles.heroWrap}>
            <MealImage url={gap.imageUrl} width="100%" height={192} />
          </View>

          {/* [1] Sticky title bar — sticks below the header as content scrolls. */}
          <View style={styles.stickyBar}>
            <Text variant="title" numberOfLines={1} style={styles.stickyTitle}>
              {gap.name}
            </Text>
          </View>

          {/* [2] Meta + tabs + the active tab's content. */}
          <View style={styles.body}>
            {gap.cuisineLabel ? (
              <Text variant="caption" color="textSecondary">
                {gap.cuisineLabel}
              </Text>
            ) : null}

            {/* Meta line: price bucket · time · the pantry-memory count "n of N
                ingredients" (count in Toast), all at body size. */}
            <View style={styles.metaRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.have}
                style={{ marginRight: spacing.sm }}
              />
              <Text variant="body" color="textSecondary">
                {`${priceBucket(gap.estCost)} · ${gap.cookTimeMin} min · `}
              </Text>
              <Text variant="body" color="toast">
                {`${haveCount} of ${gap.m}`}
              </Text>
              <Text variant="body" color="textSecondary">
                {' ingredients'}
              </Text>
            </View>

            {!gap.consistent ? (
              <Text variant="body" color="textSecondary">
                One ingredient didn&apos;t match either list — counts may be off.
              </Text>
            ) : null}

            {/* Tabs — Ingredients (default) | How to make it. */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => setTab('ingredients')}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === 'ingredients' }}
                style={[styles.tab, tab === 'ingredients' && styles.tabActive]}
              >
                <Text variant="body" color={tab === 'ingredients' ? 'text' : 'textSecondary'}>
                  Ingredients
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('howto')}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === 'howto' }}
                style={[styles.tab, tab === 'howto' && styles.tabActive]}
              >
                <Text variant="body" color={tab === 'howto' ? 'text' : 'textSecondary'}>
                  How to make it
                </Text>
              </Pressable>
            </View>

            {tab === 'ingredients' ? (
              <View style={styles.section}>
                {displayedHave.length > 0 ? (
                  <View style={styles.section}>
                    <Text variant="caption" color="textSecondary">
                      What you have
                    </Text>
                    {displayedHave.map((name) => (
                      <View key={name} style={styles.row}>
                        {/* The ONLY place Sage appears. */}
                        <Text variant="body" color="have" style={styles.marker}>
                          ✓
                        </Text>
                        <Text variant="body">{name}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {displayedToBuy.length > 0 ? (
                  <View style={styles.section}>
                    <Text variant="caption" color="textSecondary">
                      What to buy
                    </Text>
                    {displayedToBuy.map((name) => (
                      <Pressable
                        key={name}
                        onPress={() => addToPantry(name)}
                        disabled={adding.has(name)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${name} to pantry`}
                        hitSlop={{ top: 12, bottom: 12 }}
                        style={styles.row}
                      >
                        <Text variant="body" color="textSecondary" style={styles.marker}>
                          +
                        </Text>
                        <Text variant="body" color="textSecondary">
                          {name}
                        </Text>
                      </Pressable>
                    ))}
                    {pantryError ? (
                      <Text variant="body" color="textSecondary">
                        {pantryError}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.section}>
                {steps.length > 0 ? (
                  <>
                    {visibleSteps.map((step, i) => (
                      <View key={i} style={styles.row}>
                        <Text variant="body" color="textSecondary" style={styles.marker}>
                          {`${i + 1}`}
                        </Text>
                        <Text variant="body" style={styles.stepText}>
                          {step}
                        </Text>
                      </View>
                    ))}
                    {collapsible ? (
                      <Pressable
                        onPress={() => setExpanded((v) => !v)}
                        accessibilityRole="button"
                        style={styles.showAll}
                      >
                        <Text variant="caption" color="accent">
                          {expanded ? 'Show fewer steps' : `Show all ${steps.length} steps`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <Text variant="body" color="textSecondary">
                    Steps aren&apos;t available for this one
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Primary CTA — pinned at the bottom. */}
        <View style={styles.footer}>
          <PrimaryButton
            label="Make this"
            onPress={() =>
              router.push({
                pathname: '/confirm/[id]',
                params: { id, ...(option_id ? { option_id } : {}) },
              })
            }
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  // Top header bar — Bone bg, seated in the top safe-area inset (paddingTop is
  // applied inline from useSafeAreaInsets().top). Holds only the back button.
  header: {
    backgroundColor: colors.bg,
  },
  // Back button — ≥44×44 tap target, nudged toward the screen edge.
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  // Full-bleed hero: cancel the Screen's 24px side margins.
  heroWrap: {
    marginHorizontal: -layout.screenMargin,
  },
  // Sticky title bar — Bone bg (so content scrolls under it cleanly), a hairline
  // underneath to read as a bar, and the back chevron beside the name.
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  stickyTitle: {
    flex: 1,
  },
  body: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  // Meta line: all body size; baseline-align the Toast count with the prose.
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
  },
  tab: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    // Pull the active underline down onto the tab-bar hairline.
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'baseline',
  },
  marker: {
    width: spacing.lg,
  },
  stepText: {
    flex: 1,
  },
  showAll: {
    minHeight: 44,
    justifyContent: 'center',
  },
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
