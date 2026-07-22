import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getCurrentUserId, withTimeout } from '../../lib/currentUser';
import { upsizeImageUrl } from '../../lib/format';
import { getMealGreeting } from '../../lib/greeting';
import {
  buildExplanation,
  fetchRecommendations,
  materializeSelection,
  type BudgetLevel,
  type RecParams,
  type RecRow,
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

const TIER_ORDER: Record<RecRow['tier'], number> = { familiar: 0, adjacent: 1, stretch: 2 };

// One recommendation card: optional photo + cuisine eyebrow, name, meta, reason.
function RecCard({
  opt,
  explanation,
  imageUrl,
  onPress,
}: {
  opt: RecRow;
  explanation: string;
  imageUrl: string | null;
  onPress: () => void;
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
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    setImages({});
    try {
      const userId = await getCurrentUserId();
      const recs = await withTimeout(fetchRecommendations(userId, params));
      setRows(recs);
      setStatus('ready');

      // Photos are optional — fetch the shown three separately, degrade gracefully.
      const shownIds = recs.filter((r) => r.tier_rank === 0).map((r) => r.meal_id);
      supabase
        .from('meals')
        .select('id, image_url')
        .in('id', shownIds)
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

  const shown =
    rows
      ?.filter((r) => r.tier_rank === 0)
      .slice()
      .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title" style={styles.heading}>
            {getMealGreeting(new Date())}
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

        {status === 'error' && shown.length === 0 ? (
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
        ) : status === 'loading' && shown.length === 0 ? (
          <View style={styles.stateBlock}>
            <Text variant="body" color="textSecondary">
              Picking three meals…
            </Text>
          </View>
        ) : (
          shown.map((row) => (
            <RecCard
              key={row.meal_id}
              opt={row}
              explanation={buildExplanation(row)}
              imageUrl={images[row.meal_id] ?? null}
              onPress={() => onSelect(row)}
            />
          ))
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
