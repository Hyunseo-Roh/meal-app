import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FeedbackControl } from '../../components/FeedbackControl';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { loadGap, type GapData } from '../../lib/gap';
import { addPantryItem } from '../../lib/pantry';
import { colors, spacing } from '../../theme/tokens';

const EFFORT_LABEL: Record<number, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Involved',
};

type State =
  | { status: 'loading' }
  | { status: 'ready'; gap: GapData }
  | { status: 'error' };

export default function MealDetail() {
  const { id, option_id } = useLocalSearchParams<{ id: string; option_id?: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  // Optimistic overlay: names moved have←toBuy by tapping "+", plus an in-flight
  // guard and a subtle error. These sit on top of the RPC's gap (read-only).
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [pantryError, setPantryError] = useState<string | null>(null);

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
        n.delete(name); // revert to original position in toBuy
        return n;
      });
      setPantryError('Couldn’t add that. Try again.');
    } finally {
      setAdding((s) => {
        const n = new Set(s);
        n.delete(name);
        return n;
      });
    }
  }

  if (state.status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          Checking your pantry…
        </Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen style={styles.centered}>
        <Text variant="title">Couldn&apos;t open this.</Text>
        <Text variant="body" color="textSecondary" style={styles.errorBody}>
          The details didn&apos;t load. Try again.
        </Text>
        <View style={styles.retry}>
          <PrimaryButton label="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  const { gap } = state;
  const effort = EFFORT_LABEL[gap.effortLevel] ?? `Effort ${gap.effortLevel}`;
  // Apply the optimistic overlay on top of the RPC lists.
  const displayedToBuy = gap.toBuy.filter((n) => !added.has(n));
  const displayedHave = [...gap.have, ...gap.toBuy.filter((n) => added.has(n))];
  const haveCount = gap.have.length + added.size;

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
        <View style={styles.header}>
          {gap.cuisineLabel ? (
            <Text variant="caption" color="textSecondary">
              {gap.cuisineLabel}
            </Text>
          ) : null}
          <Text variant="title">{gap.name}</Text>
          <Text variant="caption" color="textSecondary">
            {`${gap.cookTimeMin} min`} · {effort} · {formatCost(gap.estCost)}
          </Text>
        </View>

        {/* Pantry-memory payoff, one calm line. */}
        <Text variant="title">{`You have ${haveCount} of ${gap.m}.`}</Text>

        {!gap.consistent ? (
          <Text variant="body" color="textSecondary">
            One ingredient didn&apos;t match either list — counts may be off.
          </Text>
        ) : null}

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
              <View key={name} style={styles.row}>
                <Pressable
                  onPress={() => addToPantry(name)}
                  disabled={adding.has(name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${name} to pantry`}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  style={styles.marker}
                >
                  <Text variant="body" color="textSecondary">
                    +
                  </Text>
                </Pressable>
                <Text variant="body" color="textSecondary">
                  {name}
                </Text>
              </View>
            ))}
            {pantryError ? (
              <Text variant="body" color="textSecondary">
                {pantryError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Taste feedback (free tier) — feeds recommend_meals' ±20 term.
            Keyed per option, so only shown when we arrived with one.
            Extra bottom margin detaches it from the fixed "Make this." footer so
            it reads as a taste signal, not a post-cook rating on that action. */}
        {option_id ? (
          <View style={styles.feedbackBlock}>
            <FeedbackControl optionId={option_id} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Make this."
          onPress={() =>
            router.push({
              pathname: '/confirm/[id]',
              params: { id, ...(option_id ? { option_id } : {}) },
            })
          }
        />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.backLink}
        >
          <Text variant="caption" color="accent">
            Back
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    // Pull the arrow toward the screen edge (arrow only — headings keep their margin).
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 0,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  description: {
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  feedbackBlock: {
    // Detach the taste feedback from the fixed "Make this." footer.
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'baseline',
  },
  marker: {
    width: spacing.lg,
  },
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorBody: {
    marginTop: -spacing.xs,
  },
  retry: {
    marginTop: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  backLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
