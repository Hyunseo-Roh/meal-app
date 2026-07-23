import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getCurrentUserId, withTimeout } from '../../lib/currentUser';
import { upsizeImageUrl } from '../../lib/format';
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
// Total "Not for me" swaps allowed per session, counted across all three cards.
const SWAP_CAP = 3;

// One recommendation card: optional photo + cuisine eyebrow, name, meta, reason.
// `footer` (the swap affordance) sits INSIDE the card body, below the reason,
// right-aligned — so it unambiguously belongs to this card, not the next one.
function RecCard({
  opt,
  explanation,
  imageUrl,
  onPress,
  footer,
}: {
  opt: RecRow;
  explanation: string;
  imageUrl: string | null;
  onPress: () => void;
  footer?: ReactNode;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      {imageUrl && !imageFailed ? (
        <Image
          source={{ uri: upsizeImageUrl(imageUrl) }}
          style={styles.cardImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={styles.cardBody}>
        <Text variant="caption" color="textSecondary" style={styles.cardEyebrow}>
          {opt.cuisine.charAt(0).toUpperCase() + opt.cuisine.slice(1)}
        </Text>
        <Text variant="title">{opt.meal}</Text>
        <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
          {`${opt.cook_time_min} min · ≈$${opt.est_cost.toFixed(2)}`}
        </Text>
        <Text variant="body" color="textSecondary" numberOfLines={2}>
          {explanation}
        </Text>
        {opt.over_time ? (
          <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
            A little longer than usual
          </Text>
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

  const [rows, setRows] = useState<RecRow[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [images, setImages] = useState<Record<string, string>>({});

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

  // Persistence seam. `matRef` memoizes the single materialize() call for the
  // current shown set; it's reset to null on every (re)fetch so the next
  // engagement persists a fresh request. The swap feature will call
  // ensureMaterialized() too — a swap rejection must attach to a persisted row.
  const matRef = useRef<Promise<{ requestId: string; optionByMeal: Map<string, string> }> | null>(
    null,
  );
  const paramsRef = useRef<RecParams>({ time: null, budget: null, mood: null });

  const load = useCallback(async (params: RecParams) => {
    paramsRef.current = params;
    matRef.current = null; // filters changed → any prior materialization is stale
    setShownRank({ familiar: 0, adjacent: 0, stretch: 0 }); // new set → show rank 0
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    setImages({});
    try {
      const userId = await getCurrentUserId();
      const recs = await withTimeout(fetchRecommendations(userId, params));
      setRows(recs);
      setStatus('ready');

      // Prefetch ALL 12 photos (not just the shown three) so a swap to an
      // alternate is instant with its image. Optional — degrades gracefully.
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
      setStatus('error');
    }
  }, []);

  // (Re)fetch on mount and whenever a filter changes. Unselected filters map to
  // nulls, so first open asks the RPC for saved-taste picks with no time pressure.
  useEffect(() => {
    load({ time, budget, mood });
  }, [time, budget, mood, load]);

  // The 3-swap cap is scoped to ONE meal decision. When the user completes a meal
  // (reaches Handled) and returns to Home, that's the next meal — refill the swap
  // budget. Filter changes don't refocus the screen, so they never refill it.
  useFocusEffect(
    useCallback(() => {
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
      matRef.current = materializeSelection(userId, paramsRef.current, current).catch((err) => {
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title" style={styles.heading}>
            {getPicksHeading(new Date())}
          </Text>
          <Text variant="body" color="textSecondary">
            Three picks — filter to narrow them
          </Text>
        </View>

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

        {status === 'error' && !hasCards ? (
          <View style={styles.stateBlock}>
            <Text variant="title">That slipped away.</Text>
            <Text variant="body" color="textSecondary">
              We couldn&apos;t pull three meals just now. Try once more.
            </Text>
            <Pressable
              onPress={() => load({ time, budget, mood })}
              accessibilityRole="button"
              style={styles.link}
            >
              <Text variant="body" color="accent">
                Try again
              </Text>
            </Pressable>
          </View>
        ) : status === 'loading' && !hasCards ? (
          <View style={styles.stateBlock}>
            <Text variant="body" color="textSecondary">
              Picking three meals…
            </Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {shownCards.map(({ tier, card, hasNext }) => (
              <RecCard
                key={tier}
                opt={card}
                explanation={buildExplanation(card)}
                imageUrl={images[card.meal_id] ?? null}
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
                That&apos;s three swaps — go with one of these
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
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
  heading: {
    marginBottom: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stateBlock: {
    gap: spacing.md,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  // Cards + the cap line grouped, so the cap line sits directly under the last
  // card rather than floating a full section-gap away.
  cards: {
    gap: spacing.lg,
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
  card: {
    backgroundColor: colors.card,
    borderColor: colors.chipBorder,
    borderWidth: 1,
    borderRadius: spacing.lg,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.card,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  // Card meta + over-time note are DATA/PROSE, not labels — drop the caption
  // role's uppercase + tracking so they read "30 min · ≈$1.50".
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  cardEyebrow: {
    marginBottom: -spacing.xs,
  },
});
