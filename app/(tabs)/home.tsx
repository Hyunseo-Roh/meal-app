import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { MealImage } from '../../components/MealImage';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { getCurrentUserId, withTimeout } from '../../lib/currentUser';
import { loadGapCounts } from '../../lib/gap';
import { getPicksHeading } from '../../lib/greeting';
import { consumeMealCompleted } from '../../lib/session';
import {
  buildExplanation,
  fetchRecommendations,
  materializeSelection,
  recordSwapRejection,
  type BudgetLevel,
  type RecParams,
  type RecRow,
  type Tier,
} from '../../lib/recommend';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

const TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: 60 },
];

const BUDGET_OPTIONS: { label: string; value: BudgetLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

// Mood is per-session, optional. Free-ish presets only.
const MOOD_OPTIONS = ['Tired', 'Comfort', 'Adventurous', 'Light', 'Quick'];

const TIERS: Tier[] = ['familiar', 'adjacent', 'stretch'];
// The three-tier thesis, rendered as a Charcoal badge ON the card photo. These
// EXACT uppercase words are probed by the user-test comprehension script — do
// not reword.
const TIER_BADGE: Record<Tier, string> = {
  familiar: 'FAMILIAR',
  adjacent: 'ONE STEP OVER',
  stretch: 'SOMETHING NEW',
};
// Total "Not for me" swaps allowed per session, counted across all three cards.
const SWAP_CAP = 3;

// Price bucket from est_cost — replaces the "≈$X.XX" format on the card meta.
function priceBucket(cost: number): string {
  if (cost <= 5) return '$5 & under';
  if (cost <= 10) return '$10 & under';
  return 'Over $10';
}

// Cuisine names arrive lowercase from the RPC ("italian"); Title-case for the
// meta line. All 10 cuisines are single words, so first-letter capitalization
// is sufficient.
function titleCaseCuisine(name: string): string {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// One recommendation card — a vertical card: photo on top with the tier badge
// overlaid top-left, then meal name (Literata 24), a meta line (cuisine · time ·
// price bucket), the one-line reason, and — once its ingredient counts resolve —
// a gap row (Sage check + Toast "n of N ingredients" at body size). `footer` (the swap
// affordance) sits right-aligned at the bottom.
function RecCard({
  opt,
  explanation,
  imageUrl,
  gap,
  onPress,
  footer,
}: {
  opt: RecRow;
  explanation: string;
  imageUrl: string | null;
  gap?: { have: number; total: number };
  onPress: () => void;
  footer?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <View style={styles.imageWrap}>
        <MealImage url={imageUrl} width="100%" height={160} />
        {/* Tier badge ON the photo — Charcoal pill, Bone text. */}
        <View style={styles.tierBadge}>
          <Text variant="caption" color="bg">
            {TIER_BADGE[opt.tier]}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text variant="title" numberOfLines={3}>
          {opt.meal}
        </Text>
        <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
          {`${titleCaseCuisine(opt.cuisine)} · ${opt.cook_time_min} min · ${priceBucket(opt.est_cost)}`}
        </Text>
        {/* Card body copy — second in hierarchy after the title, so primary
            Charcoal (the meta + gap rows below stay muted/secondary). */}
        <Text variant="body" color="text" numberOfLines={2}>
          {explanation}
        </Text>
        {opt.over_time ? (
          <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
            A little longer, but close
          </Text>
        ) : null}
        {/* Gap row — appears only once counts resolve; no spinner, no shift. */}
        {gap ? (
          <View style={styles.gapRow}>
            {/* The ONLY place Sage appears on Home (have/success). */}
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.have}
              style={{ marginRight: spacing.sm }}
            />
            <Text variant="body" color="toast">
              {`${gap.have} of ${gap.total}`}
            </Text>
            <Text variant="body" color="textSecondary">
              {' ingredients'}
            </Text>
          </View>
        ) : null}
        {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
      </View>
    </Pressable>
  );
}

/**
 * Home — the merged three-meals view. Opens straight to three picks (no form).
 * Time / budget / mood are inline filters that start UNSELECTED; changing one
 * re-runs the rule-based RPC in place (a pure read, no DB write). The request
 * row + its 12 options are persisted lazily, on FIRST ENGAGEMENT (first card tap
 * or — once built — first swap), never on filter changes.
 */
export default function Home() {
  const router = useRouter();

  const [time, setTime] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  // Filters are collapsed to a summary row by default; tapping expands the chip
  // groups in place. Starts collapsed on every arrival (see the focus effect).
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [rows, setRows] = useState<RecRow[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [images, setImages] = useState<Record<string, string>>({});
  // The user's favorite cuisine NAMES (from pref_cuisine_ids), loaded once —
  // favorites don't change mid-session. Gates whether an explanation may claim a
  // cuisine is "familiar" to the user; empty (default AND failure fallback) →
  // honest, taste-neutral copy. The ref mirror keeps materialize() current
  // without adding a dependency that would churn its memo.
  const [favCuisines, setFavCuisines] = useState<Set<string>>(new Set());
  const favCuisinesRef = useRef<Set<string>>(new Set());
  // The user's first name for the header eyebrow. Null/empty → no eyebrow (legacy
  // rows unchanged). Read alongside the favorites lookup — no extra fetch.
  const [firstName, setFirstName] = useState<string | null>(null);
  // In-place re-run (filter change while cards are already shown): `refreshing`
  // dims the current cards without blanking or shifting layout; `refreshError`
  // marks that the last re-run failed, so the visible cards are the PREVIOUS
  // result. Both are distinct from the initial `status` loading/error path.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  // Mirrors `rows` presence so `load` can tell an initial load from a re-run
  // without depending on `rows` (which would recreate load and re-fire the effect).
  const rowsRef = useRef<RecRow[] | null>(null);

  // Which within-tier rank is currently shown per tier. Resets with each new row
  // set (filter change) — a fresh shown trio starts at rank 0.
  const [shownRank, setShownRank] = useState<Record<Tier, number>>({
    familiar: 0,
    adjacent: 0,
    stretch: 0,
  });
  // Swap budget: 3 total across all three cards. PERSISTS across filter changes
  // within the session — otherwise toggling a filter would refill the budget and
  // defeat the cap. swapsRef is the tap-proof source of truth for the guard;
  // swapsUsed mirrors it for rendering.
  const swapsRef = useRef(0);
  const [swapsUsed, setSwapsUsed] = useState(0);

  // Ingredient-gap counts per meal id for the card gap row. Cached for the whole
  // session (keyed by meal id), so filter changes / swaps never refetch a count
  // we already know. `gapInFlight` de-dupes concurrent fetches for the same meal.
  const [gapCounts, setGapCounts] = useState<Record<string, { have: number; total: number }>>({});
  const gapInFlight = useRef<Set<string>>(new Set());

  // Persistence seam. `matRef` memoizes the single materialize() call for the
  // current shown set; it's reset to null on every (re)fetch so the next
  // engagement persists a fresh request. The swap feature will call
  // ensureMaterialized() too — a swap rejection must attach to a persisted row.
  const matRef = useRef<Promise<{ requestId: string; optionByMeal: Map<string, string> }> | null>(
    null,
  );
  const paramsRef = useRef<RecParams>({ time: null, budget: null, mood: null });

  const load = useCallback(async (params: RecParams) => {
    // Re-run (cards already shown) vs initial load. On a re-run we keep the
    // current cards visible and only signal via `refreshing`; we do NOT touch
    // rows/params/shownRank until success, so a failed re-run leaves the prior
    // set fully intact and still engageable.
    const isRefresh = rowsRef.current != null;
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError(false);
    } else {
      setStatus('loading');
    }
    try {
      const userId = await getCurrentUserId();
      const recs = await withTimeout(fetchRecommendations(userId, params));
      // Success — commit the new set and reset the per-set state.
      rowsRef.current = recs;
      paramsRef.current = params;
      matRef.current = null; // new set → any prior materialization is stale
      setShownRank({ familiar: 0, adjacent: 0, stretch: 0 });
      setRows(recs);
      setStatus('ready');
      setRefreshing(false);
      setRefreshError(false);

      // Prefetch ALL 12 photos (not just the shown three) so a swap to an
      // alternate is instant with its image. Overwrites the prior map on success;
      // during a re-run the old photos stay put so cards don't flicker.
      const allIds = recs.map((r) => r.meal_id);
      supabase
        .from('meals')
        .select('id, image_url')
        .in('id', allIds)
        .then(({ data }) => {
          const map: Record<string, string> = {};
          (data ?? []).forEach((r) => {
            if (r.image_url) map[r.id as string] = r.image_url as string;
          });
          setImages(map);
        });
    } catch {
      if (isRefresh) {
        // Keep the last-good cards; mark them as the previous result.
        setRefreshing(false);
        setRefreshError(true);
      } else {
        setStatus('error');
      }
    }
  }, []);

  // (Re)fetch on mount and whenever a filter changes. Unselected filters map to
  // nulls, so first open asks the RPC for saved-taste picks with no time pressure.
  useEffect(() => {
    load({ time, budget, mood });
  }, [time, budget, mood, load]);

  // Resolve the user's favorite cuisine NAMES once (pref_cuisine_ids → names) to
  // compare against each row's cuisine. Any failure (or no favorites) leaves the
  // set empty, so the copy stays honest rather than risking a false claim.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const userId = await getCurrentUserId();
        const { data: u } = await supabase
          .from('users')
          .select('pref_cuisine_ids, first_name')
          .eq('id', userId)
          .single();
        // Set the name first — it must show even for a user with no favorites
        // (below the early return). Stored as entered; no casing applied.
        if (active) {
          const name = ((u?.first_name as string | null) ?? '').trim();
          setFirstName(name || null);
        }
        const ids = (u?.pref_cuisine_ids as string[] | null) ?? [];
        if (ids.length === 0) return;
        const { data: cs } = await supabase.from('cuisines').select('name').in('id', ids);
        if (!active) return;
        const set = new Set((cs ?? []).map((c) => c.name as string));
        favCuisinesRef.current = set;
        setFavCuisines(set);
      } catch {
        // leave the set empty → honest, taste-neutral copy
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // The 3-swap cap is scoped to ONE meal decision. When the user completes a meal
  // (reaches Handled) and returns to Home, that's the next meal — refill the swap
  // budget. Filter changes don't refocus the screen, so they never refill it.
  useFocusEffect(
    useCallback(() => {
      // Every arrival at Home starts with filters collapsed. Filter chip taps
      // don't refocus the screen, so adjusting filters keeps the panel open.
      setFiltersOpen(false);
      if (consumeMealCompleted()) {
        swapsRef.current = 0;
        setSwapsUsed(0);
      }
    }, []),
  );

  // Persist once for the current shown set, then reuse. The seam swap will share.
  const ensureMaterialized = useCallback(async () => {
    if (!matRef.current) {
      const userId = await getCurrentUserId();
      const current = rows ?? [];
      matRef.current = materializeSelection(
        userId,
        paramsRef.current,
        current,
        favCuisinesRef.current,
      ).catch((err) => {
        matRef.current = null; // let a later engagement retry
        throw err;
      });
    }
    return matRef.current;
  }, [rows]);

  const onSelect = useCallback(
    async (row: RecRow) => {
      try {
        const { optionByMeal } = await ensureMaterialized();
        const optionId = optionByMeal.get(row.meal_id);
        if (!optionId) throw new Error('option_missing');
        router.push({ pathname: '/option/[id]', params: { id: optionId } });
      } catch {
        setStatus('error');
      }
    },
    [ensureMaterialized, router],
  );

  // Rows for one tier, in tier_rank order (0 = shown, 1..3 = alternates).
  const tierRows = useCallback(
    (tier: Tier) =>
      (rows ?? []).filter((r) => r.tier === tier).sort((a, b) => a.tier_rank - b.tier_rank),
    [rows],
  );

  // "Not for me": swap the rejected card for the next-ranked alternate in the
  // same tier. Optimistic + in-memory (no refetch); the rejection write is
  // best-effort in the background and never reverts the card already shown.
  const onSwap = useCallback(
    (tier: Tier, rejected: RecRow) => {
      const list = tierRows(tier);
      const cur = shownRank[tier];
      // Tap-proof cap guard via ref; also require a next alternate to exist.
      if (swapsRef.current >= SWAP_CAP || cur + 1 >= list.length) return;

      swapsRef.current += 1;
      setSwapsUsed(swapsRef.current);
      setShownRank((prev) => ({ ...prev, [tier]: prev[tier] + 1 }));

      void (async () => {
        try {
          const { optionByMeal } = await ensureMaterialized();
          const optionId = optionByMeal.get(rejected.meal_id);
          if (optionId) {
            const userId = await getCurrentUserId();
            await recordSwapRejection(userId, optionId);
          }
        } catch {
          // Best-effort: the signal is nice-to-have; never revert a shown card.
        }
      })();
    },
    [tierRows, shownRank, ensureMaterialized],
  );

  // The currently shown card per tier, plus whether an alternate remains.
  const shownCards = TIERS.map((tier) => {
    const list = tierRows(tier);
    const card = list[shownRank[tier]] ?? list[0];
    return { tier, card, hasNext: shownRank[tier] + 1 < list.length };
  }).filter((x): x is { tier: Tier; card: RecRow; hasNext: boolean } => Boolean(x.card));

  const capped = swapsUsed >= SWAP_CAP;
  const hasCards = shownCards.length > 0;

  // Once the shown cards are known, fetch ingredient-gap counts for each in
  // parallel; each resolves into `gapCounts` and reveals that card's gap row.
  // Skips meals already cached or in flight, so filter changes and swaps only
  // fetch genuinely new meals. A failure is swallowed — the row just won't show.
  const shownMealIds = shownCards.map((c) => c.card.meal_id).join(',');
  useEffect(() => {
    for (const { card } of shownCards) {
      const id = card.meal_id;
      if (gapCounts[id] || gapInFlight.current.has(id)) continue;
      gapInFlight.current.add(id);
      loadGapCounts(id)
        .then((counts) => setGapCounts((prev) => ({ ...prev, [id]: counts })))
        .catch(() => {
          /* no row on error — no spinner, no shift */
        })
        .finally(() => gapInFlight.current.delete(id));
    }
    // shownMealIds captures exactly the identities we depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownMealIds]);

  // Compact filter summary (collapsed default). Unset dimensions read as "Any …".
  const timeLabel =
    time === null ? 'Any time' : (TIME_OPTIONS.find((o) => o.value === time)?.label ?? 'Any time');
  const budgetLabel =
    budget === null
      ? 'Any budget'
      : (BUDGET_OPTIONS.find((o) => o.value === budget)?.label ?? 'Any budget');
  const filterSummary = `${timeLabel} · ${budgetLabel} · ${mood ?? 'Any mood'}`;

  return (
    <Screen>
      <View style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          {/* Address-by-name eyebrow above the unchanged heading, sentence case
              (body, not the uppercasing caption). Absent for legacy rows with no
              first_name, so the header stays as-is. */}
          {firstName ? (
            <Text variant="body" color="textSecondary">
              {`Hi ${firstName}`}
            </Text>
          ) : null}
          {/* No page icon on Home: the full "{Meal}, sorted for you" line needs
              the width, and with the fork/knife glyph eating ~52px it wraps to a
              second line on narrow phones (≤375px). Eyebrow above and subtitle
              below are unchanged. */}
          <Text variant="title" style={styles.heading}>
            {getPicksHeading(new Date())}
          </Text>
          <Text variant="body" color="textSecondary">
            Three picks from the cuisines you like. Filter or tap to start.
          </Text>
        </View>

        {status === 'error' && !hasCards ? (
          <ErrorState
            title="That slipped away"
            message="The three meals didn't come through"
            onRetry={() => load({ time, budget, mood })}
          />
        ) : status === 'loading' && !hasCards ? (
          <LoadingState message="Picking three meals…" />
        ) : (
          <View style={styles.cardsWrap}>
            {/* Re-run failed — the cards below are the PREVIOUS result. Surface it
                inline; keep the last-good cards; offer a retry. (Placeholder copy.) */}
            {refreshError ? (
              <ErrorState
                title="Showing your previous picks"
                message="The new set didn't come through"
                onRetry={() => load({ time, budget, mood })}
              />
            ) : null}
            {/* During a re-run the cards dim (no layout shift) with a spinner
                overlaid, so it's clear new picks are coming without blanking. */}
            <View style={[styles.cards, refreshing && styles.cardsDim]}>
              {shownCards.map(({ tier, card, hasNext }) => (
                <RecCard
                  key={tier}
                  opt={card}
                  explanation={buildExplanation(card, favCuisines)}
                  imageUrl={images[card.meal_id] ?? null}
                  gap={gapCounts[card.meal_id]}
                  onPress={() => onSelect(card)}
                  // Swap affordance lives INSIDE the card. At the cap it disappears
                  // entirely (not dimmed); when the lane is exhausted a muted,
                  // borderless note takes its place.
                  footer={
                    capped ? null : !hasNext ? (
                      <Text variant="caption" color="textSecondary" style={styles.swapNote}>
                        Nothing else in this lane
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() => onSwap(tier, card)}
                        accessibilityRole="button"
                        accessibilityLabel={`Not for me — swap ${card.meal}`}
                        style={styles.swapPill}
                      >
                        <Text variant="caption" style={styles.swapPillText}>
                          Not for me
                        </Text>
                      </Pressable>
                    )
                  }
                />
              ))}
              {capped ? (
                <Text variant="body" color="textSecondary">
                  No more swaps — go with one of these
                </Text>
              ) : null}
            </View>
            {refreshing ? (
              <View style={styles.refreshOverlay} pointerEvents="none">
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Expanded chip panel — anchored ABOVE the floating bar. Same chips, same
          behavior (swap-cap logic untouched). Scrolls if it outgrows its cap. */}
      {filtersOpen ? (
        <View style={styles.filterPanel}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.filterPanelContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Cook time
              </Text>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={time === opt.value}
                    // Tap again to clear — unset means no time constraint.
                    onPress={() => setTime((prev) => (prev === opt.value ? null : opt.value))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Budget
              </Text>
              <View style={styles.chipRow}>
                {BUDGET_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={budget === opt.value}
                    // Tap again to clear — unset falls back to your saved budget.
                    onPress={() => setBudget((prev) => (prev === opt.value ? null : opt.value))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Mood — optional
              </Text>
              <View style={styles.chipRow}>
                {MOOD_OPTIONS.map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    selected={mood === m}
                    onPress={() => setMood((prev) => (prev === m ? null : m))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Floating filter bar — Charcoal pill fixed above the tab bar, in thumb
          reach. Reflects the set values; tap to expand/collapse the panel. */}
      <Pressable
        onPress={() => setFiltersOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Filters: ${filterSummary}`}
        style={styles.filterBar}
      >
        <Text variant="body" color="bg">
          {filterSummary}
        </Text>
        <Ionicons
          name={filtersOpen ? 'chevron-down' : 'chevron-up'}
          size={20}
          color={colors.bg}
        />
      </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Column: the scroll area (flex) sits above the docked filter bar, so the bar
  // is pinned just above the tab bar and always in thumb reach without overlaying
  // — and reliably receives taps (an absolute Pressable over a ScrollView loses
  // the press on web).
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  // Extra heading→subtitle breathing room; now carried by the title row so the
  // centered text isn't nudged off the icon's vertical center.
  heading: {
    // Clear space below the now two-line title so it doesn't crowd the subhead.
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Relative wrapper so the re-run spinner can overlay the cards without shifting
  // layout, and so a refresh-error notice can sit above them.
  cardsWrap: {
    gap: spacing.lg,
  },
  // Cards + the cap line grouped, so the cap line sits directly under the last
  // card rather than floating a full section-gap away.
  cards: {
    gap: spacing.lg,
  },
  // Dim (not blank) the current cards during an in-place re-run — opacity only,
  // so nothing reflows.
  cardsDim: {
    opacity: 0.4,
  },
  // Spinner centered over the dimmed cards; absolute so it adds no height.
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Swap-affordance slot inside the card body: right-aligned under the reason.
  cardFooter: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  // "Not for me" — a low-emphasis ghost pill: Charcoal text at 13, Warm Gray
  // hairline border, pill radius, no fill. Reads as tappable on the Greige card.
  swapPill: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  swapPillText: {
    // Caption size (13) but not shouted — drop the role's uppercase + tracking.
    textTransform: 'none',
    letterSpacing: 0,
  },
  // Exhausted-lane note in the same slot — muted, no border (not tappable).
  swapNote: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  // Vertical card: image on top, text below.
  card: {
    backgroundColor: colors.card,
    borderColor: colors.chipBorder,
    borderWidth: 1,
    borderRadius: spacing.lg,
    overflow: 'hidden',
  },
  // Relative wrapper so the tier badge can overlay the photo top-left.
  imageWrap: {
    width: '100%',
  },
  // Tier badge ON the photo: Charcoal pill, Bone text (caption role supplies the
  // uppercase + tracking). Absolute, pinned top-left over the image.
  tierBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  // Card meta + over-time note are DATA/PROSE, not labels — drop the caption
  // role's uppercase + tracking so they read "Italian · 30 min · $5 & under".
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  // Gap row: Sage check + Toast "N of M" + " ingredients", all at body size.
  // Baseline-aligned so the count sits on the body line.
  gapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  // Expanded chip panel — docked directly above the bar (normal flow), so its
  // chips receive taps reliably. Capped height; chips scroll if they outgrow it.
  filterPanel: {
    maxHeight: 320,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.lg,
    padding: spacing.lg,
  },
  filterPanelContent: {
    gap: spacing.lg,
  },
  // Docked Charcoal filter bar — pinned above the tab bar, in thumb reach.
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
