import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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

// Bare procedural headers that carry no information. "For X:" is deliberately
// NOT in this list — it marks a sub-recipe ("For Peanut Sauce:") and must survive.
const HEADER = 'Method|Directions|Instructions|Preparation';

// Steps longer than this get a "Show all N steps" toggle; at/below it, all render.
const STEP_THRESHOLD = 10;
const STEP_CAP = 8;

/**
 * Display-only cleanup of Spoonacular's raw step text — NEVER written back to
 * the DB. Their stored strings collapse sentence boundaries ("onions.For Peanut
 * Sauce:Method:Bring...") and carry orphan headers. Audited over all 46 seeded
 * meals / 326 steps: 52 altered, 0 bad splits, 0 "For X:" headers lost.
 */
function normalizeStep(s: string): string {
  return (
    s
      // Run-on sentence. Requires lowercase/digit BEFORE the period so "U.S."
      // (uppercase before) and decimals like "3.5" are never split.
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      // Same for run-on colons: "Method:Marinate" -> "Method: Marinate".
      .replace(/([a-z]):([A-Z])/g, '$1: $2')
      // Leading orphan headers, repeatedly: "For satay:Method:" -> "".
      .replace(new RegExp(`^(?:(?:For\\s[^:]{1,40}|${HEADER})\\s*:\\s*)+`, 'i'), '')
      // Bare header as its own clause, anywhere. Case-SENSITIVE and anchored to a
      // clause boundary, so a mid-sentence "using this method: stir" is untouched.
      .replace(new RegExp(`(^|[.:]\\s*)(?:${HEADER})\\s*:\\s*`, 'g'), '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

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
  // Steps collapse — local only, resets per meal. Nothing persisted.
  const [expanded, setExpanded] = useState(false);

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

  // Steps: normalize for display, then gate. A single step is upstream junk
  // ("Whatch video", a bare link), so >= 2 is the bar for showing the section at
  // all — which also lets a not-yet-seeded (NULL) meal render exactly as before.
  const steps = (gap.instructions ?? []).map(normalizeStep).filter(Boolean);
  const showSteps = steps.length >= 2;
  const collapsible = steps.length > STEP_THRESHOLD;
  const visibleSteps = collapsible && !expanded ? steps.slice(0, STEP_CAP) : steps;

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
        <Text variant="title">{`You have ${haveCount} of ${gap.m}`}</Text>

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

        {/* Steps sit BEFORE "Make this" on purpose: you see what the cooking
            involves while still deciding, not after committing. */}
        {showSteps ? (
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              How to make it
            </Text>
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
                style={styles.backLink}
              >
                <Text variant="caption" color="accent">
                  {expanded ? 'Show fewer steps' : `Show all ${steps.length} steps`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'baseline',
  },
  marker: {
    width: spacing.lg,
  },
  // Let a step wrap in the column beside the number, instead of overflowing.
  stepText: {
    flex: 1,
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
