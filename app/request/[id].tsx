import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MealCard } from '../../components/MealCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatCost } from '../../lib/format';
import { loadOptions, TIER_LABEL, type OptionCard } from '../../lib/recommend';
import { colors, spacing } from '../../theme/tokens';

type State =
  | { status: 'loading' }
  | { status: 'ready'; options: OptionCard[] }
  | { status: 'error' };

export default function ThreeOptions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    try {
      const options = await loadOptions(id);
      setState({ status: 'ready', options });
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
          Picking your three…
        </Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen style={styles.centered}>
        <Text variant="title">Tonight slipped away.</Text>
        <Text variant="body" color="textSecondary" style={styles.errorBody}>
          We couldn&apos;t pull your three just now. Try once more.
        </Text>
        <View style={styles.retry}>
          <PrimaryButton label="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

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
          <Text variant="title">Tonight: three options.</Text>
          <Text variant="body" color="textSecondary">
            Picked for you — tap one to see why.
          </Text>
        </View>

        {state.options.map((opt) => (
          <MealCard
            key={opt.optionId || opt.meal_id}
            tierLabel={TIER_LABEL[opt.tier]}
            name={opt.meal}
            contextLine={opt.explanation}
            cookTime={`${opt.cook_time_min} min`}
            cost={formatCost(opt.est_cost)}
            overTime={opt.over_time}
            onPress={() =>
              router.push({ pathname: '/option/[id]', params: { id: opt.optionId } })
            }
          />
        ))}

        <View style={styles.backLink}>
          <Text
            variant="caption"
            color="accent"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
          >
            Back to start
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
  backLink: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
