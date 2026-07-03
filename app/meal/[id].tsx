import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { loadGap, type GapData } from '../../lib/gap';
import { colors, spacing } from '../../theme/tokens';

const EFFORT_LABEL: Record<number, string> = {
  1: 'Low effort',
  2: 'Some effort',
  3: 'More effort',
};

type State =
  | { status: 'loading' }
  | { status: 'ready'; gap: GapData }
  | { status: 'error' };

export default function MealDetail() {
  const { id, option_id } = useLocalSearchParams<{ id: string; option_id?: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

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
          {gap.description ? (
            <Text variant="body" color="textSecondary" style={styles.description}>
              {gap.description}
            </Text>
          ) : null}
        </View>

        {/* Pantry-memory payoff, one calm line. */}
        <Text variant="title">{`You have ${gap.n} of ${gap.m}.`}</Text>

        {!gap.consistent ? (
          <Text variant="body" color="textSecondary">
            One ingredient didn&apos;t match either list — counts may be off.
          </Text>
        ) : null}

        {gap.have.length > 0 ? (
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              What you have
            </Text>
            {gap.have.map((name) => (
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

        {gap.toBuy.length > 0 ? (
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              What to buy
            </Text>
            {gap.toBuy.map((name) => (
              <View key={name} style={styles.row}>
                <Text variant="body" color="textSecondary" style={styles.marker}>
                  +
                </Text>
                <Text variant="body" color="textSecondary">
                  {name}
                </Text>
              </View>
            ))}
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
        <View style={styles.backLink}>
          <Text variant="caption" color="accent" onPress={() => router.back()}>
            Back
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    paddingTop: spacing.xs,
    paddingBottom: 0,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.xs,
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
  },
});
