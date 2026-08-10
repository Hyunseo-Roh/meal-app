import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { MealImage } from '../../components/MealImage';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { getCurrentUserId, withTimeout } from '../../lib/currentUser';
import { loadGapCounts } from '../../lib/gap';
import { getPicksHeading } from '../../lib/greeting';
import { TIER_REASON } from '../../lib/reasons';
import { consumeMealCompleted } from '../../lib/session';
import {
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
// The three-tier thesis, rendered as a Charcoal badge ON the card photo. Labels
// describe the selection logic: familiar = top-scoring match, adjacent = a strong
// pick in a different cuisine, stretch = a lower-ranked change of pace.
const TIER_BADGE: Record<Tier, string> = {
  familiar: 'BEST MATCH',
  adjacent: 'WORTH A TRY',
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
  imageUrl,
  gap,
  onPress,
  footer,
}: {
  opt: RecRow;
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
        {/* Tier reason — one 13px Inter (sentence-case) line in textSecondary,
            directly under the title and above the meta. Single source of truth:
            TIER_REASON in lib/reasons.ts (also used by the why screen). */}
        <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
          {TIER_REASON[opt.tier]}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
            {`${titleCaseCuisine(opt.cuisine)} · ${opt.cook_time_min} min · ${priceBucket(opt.est_cost)}`}
          </Text>
          {/* Over-time marker as a quiet Warm Gray pill, separated from the meta
              prose. Wraps below when the row is tight. Only when over_time. */}
          {opt.over_time ? (
            <View style={styles.overTimePill}>
              <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                over your time
              </Text>
            </View>
          ) : null}
        </View>
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
  // Single filter bar under the header (summary text names time/budget/mood);
  // tapping toggles the three chip sections inline below it. Collapsed by
  // default; NOT force-collapsed on arrival (the summary keeps Mood visible).
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [rows, setRows] = useState<RecRow[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [images, setImages] = useState<Record<string, string>>({});
  // The user's favorite cuisine NAMES (from pref_cuisine_ids), loaded once —
  // favorites don't change mid-session. Feeds materialize() → the persisted
  // per-meal explanation shown on the "Why we chose this" screen (gates whether
  // it may claim a cuisine is "familiar"); empty (default AND failure fallback)
  // → honest, taste-neutral copy. A ref, not state: the Home card no longer
  // renders the explanation, so nothing needs to re-render when favorites load.
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
  // The currently shown meal ids, mirrored into a ref (synced by an effect further
  // down, once shownMealIds is computed) so the focus/visibility listeners always
  // see the latest shown cards.
  const shownIdsRef = useRef<string[]>([]);

  // Gap-only refresh: re-fetch get_ingredient_gap counts for the CURRENTLY SHOWN
  // meals and OVERWRITE just those gapCounts entries (bypassing the cache skip-
  // guard that otherwise freezes a count for the session). Never touches the rec
  // rows / shownRank / swapsUsed / matRef — the 3 cards stay identical; only the
  // numbers move. Reads shownIdsRef + stable setter/ref/import, so useCallback([])
  // stays fresh with no stale rows/shownRank closure. gapInFlight de-dupes so an
  // in-flight refresh isn't doubled.
  const refreshShownGaps = useCallback(() => {
    for (const id of shownIdsRef.current) {
      if (gapInFlight.current.has(id)) continue; // a refresh already running — don't double
      gapInFlight.current.add(id);
      loadGapCounts(id)
        .then((counts) => setGapCounts((prev) => ({ ...prev, [id]: counts })))
        .catch(() => {
          /* leave the existing count in place on a transient error */
        })
        .finally(() => gapInFlight.current.delete(id));
    }
  }, []);

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
      if (consumeMealCompleted()) {
        swapsRef.current = 0;
        setSwapsUsed(0);
      }
      // Case A — app-tab switch (e.g. Pantry → Home). Refresh the shown cards' gap
      // counts so a pantry edit is reflected. Gap-only: no rec refetch, no reshuffle.
      refreshShownGaps();
      // Re-read the greeting name on every focus (cheap single-column select), so
      // editing it in Profile → the name editor is reflected here — Home is a
      // persistent tab, so the mount-only load above won't pick up the change.
      let active = true;
      (async () => {
        try {
          const userId = await getCurrentUserId();
          const { data: u } = await supabase
            .from('users')
            .select('first_name')
            .eq('id', userId)
            .single();
          if (active) setFirstName(((u?.first_name as string | null) ?? '').trim() || null);
        } catch {
          // Keep the current name on a transient read failure.
        }
      })();
      return () => {
        active = false;
      };
    }, [refreshShownGaps]),
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
  // Surface the remaining budget on the pill only when ONE swap is left before
  // the cap, so the wall isn't a surprise (2+ left stays the plain label).
  const swapLabel = swapsUsed === SWAP_CAP - 1 ? 'Show another (1 left)' : 'Show another';
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

  // Keep shownIdsRef in step with the shown cards, so the once-registered focus/
  // visibility listeners read the LATEST shown ids (swaps change them) rather than
  // a mount-time snapshot. Same identity list the fetch effect keys on — no second
  // notion of "shown". (uuids never contain commas, so splitting the join is safe.)
  useEffect(() => {
    shownIdsRef.current = shownMealIds ? shownMealIds.split(',') : [];
  }, [shownMealIds]);

  // Case B — browser tab/window switch. The route stays mounted, so useFocusEffect
  // does NOT fire; only the DOM signals the return. On becoming visible/focused
  // again, refresh the shown cards' gap counts. Web-only; registered once (handler
  // is stable and reads shownIdsRef, so it's never a mount-time snapshot).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshShownGaps();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshShownGaps);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshShownGaps);
    };
  }, [refreshShownGaps]);

  // Compact filter summary shown on the bar. Unset dimensions read as "Any …".
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
          {/* Page-title icon + heading — same header structure as Pantry/Profile.
              The title can wrap to two lines on narrow phones; the icon box is one
              line tall and the row top-aligns, so the icon anchors to line 1. */}
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              {/* Fork & knife — intentionally shares the glyph with the meal-card
                  image placeholder on this screen; preferred over sparkles. */}
              <Ionicons name="restaurant-outline" size={30} color={colors.textSecondary} />
            </View>
            <Text variant="title">{getPicksHeading(new Date())}</Text>
          </View>
          <Text variant="body" color="textSecondary">
            Three picks from the cuisines you like. Filter or tap to start.
          </Text>
        </View>

        {/* Filters — a single Charcoal summary bar directly under the header,
            ABOVE the cards. Its text names time/budget/mood; tapping expands the
            three chip sections inline BELOW the bar, pushing the cards down.
            Normal flow inside the ScrollView, so chip taps register. */}
        <View style={styles.filters}>
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
              name={filtersOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.bg}
            />
          </Pressable>

          {filtersOpen ? (
            <View style={styles.filterPanel}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.filterPanelContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Honesty line — first thing in the panel: time and mood are soft
                    ranking signals, not hard filters (matches the RPC — only
                    disliked cuisine is a hard cut). The panel's gap:16 spaces it
                    off the COOK TIME section below. */}
                <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                  Time and mood guide your picks — they&apos;re not strict filters.
                </Text>

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
                        accessibilityLabel={`Show another ${tier} pick instead of ${card.meal}`}
                        style={styles.swapPill}
                      >
                        <Ionicons name="refresh" size={14} color={colors.text} />
                        <Text variant="caption" style={styles.swapPillText}>
                          {swapLabel}
                        </Text>
                      </Pressable>
                    )
                  }
                />
              ))}
              {capped ? (
                <Text variant="body" color="textSecondary">
                  That&apos;s the set — pick one to start
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Full-height column wrapping the scroll area.
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
  // Shared header layout (matches Pantry/Profile): icon + serif title. The icon
  // box is the glyph's size (not a wider 44px box) so it sits flush at the 24px
  // content margin instead of indented by the box's centring slack; the row
  // top-aligns and the box is one line tall so the icon anchors to line 1 when
  // the title wraps.
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
  // Filter block under the header: the Charcoal summary bar, then (when open) the
  // expanded chip panel inline below it. The `gap` spaces bar → panel; the outer
  // content gap separates the whole block from the header and the cards.
  filters: {
    gap: spacing.sm,
  },
  // Charcoal filter bar — a single pill under the header, summary text + chevron.
  // No vertical margins: the content/filters gaps handle its spacing here (top
  // placement inside the ScrollView, not the old bottom-docked position).
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Expanded chip panel — inline below the bar. Capped height; chips scroll if
  // they outgrow it.
  filterPanel: {
    maxHeight: 320,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.lg,
    padding: spacing.lg,
  },
  filterPanelContent: {
    gap: spacing.lg,
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
  // "Show another" — a secondary pill: refresh icon + Charcoal 13px text, Warm
  // Gray hairline, and a subtle Bone fill so it separates from the Butter card
  // and is findable without competing with the whole-card tap (not Charcoal).
  swapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    backgroundColor: colors.bg,
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
    // Warm Butter fill + a 1px deep-Toast hairline so the card reads as a distinct,
    // appetite-friendly surface and the boundary passes WCAG 1.4.11 (3:1): border
    // vs Bone = 3.75:1, Charcoal text vs fill = 9.81:1. (Warm accent family — not
    // gray textSecondary, not Charcoal which is reserved for badges/primary buttons.)
    backgroundColor: colors.recCard,
    borderColor: colors.recCardBorder,
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
  // Meta prose + the optional over-time pill on one row; the pill wraps below
  // when the line is tight. sm gap keeps the pill clear of the prose.
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Quiet Warm Gray pill — NOT Sage/Toast (those are reserved). Full-radius, no
  // border, no gradient; matches the pantry badge's compact rhythm.
  overTimePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chipBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  // Gap row: Sage check + Toast "N of M" + " ingredients", all at body size.
  // Baseline-aligned so the count sits on the body line.
  gapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
});
