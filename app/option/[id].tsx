import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { TIER_LABEL } from '../../lib/recommend';
import { loadWhy, type WhyData } from '../../lib/reasons';
import { spacing } from '../../theme/tokens';

type State =
  | { status: 'loading' }
  | { status: 'ready'; why: WhyData }
  | { status: 'error' };

export default function WhyWeChose() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    try {
      const why = await loadWhy(id);
      setState({ status: 'ready', why });
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
          Here&apos;s why…
        </Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen style={styles.centered}>
        <Text variant="title">Lost the thread.</Text>
        <Text variant="body" color="textSecondary" style={styles.errorBody}>
          We couldn&apos;t pull this one up. Try again.
        </Text>
        <View style={styles.retry}>
          <PrimaryButton label="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  const { why } = state;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="caption" color="textSecondary">
            {TIER_LABEL[why.tier]}
            {why.cuisineLabel ? ` · ${why.cuisineLabel}` : ''}
          </Text>
          <Text variant="title">{why.name}</Text>
          <Text variant="body" color="textSecondary">
            Picked for you — here&apos;s why.
          </Text>
        </View>

        <View style={styles.reasons}>
          {why.reasons.map((line, i) => (
            <Text key={i} variant="body">
              {line}
            </Text>
          ))}
        </View>

        {why.description ? (
          <Text variant="body" color="textSecondary">
            {why.description}
          </Text>
        ) : null}

        <Text variant="caption" color="textSecondary">
          {`${why.cookTimeMin} min`} · {formatCost(why.estCost)}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="See what's in it."
          onPress={() => router.push({ pathname: '/meal/[id]', params: { id: why.mealId } })}
        />
        <View style={styles.backLink}>
          <Text variant="caption" color="accent" onPress={() => router.back()}>
            Back to tonight&apos;s three
          </Text>
        </View>
      </View>
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
  reasons: {
    gap: spacing.md,
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
