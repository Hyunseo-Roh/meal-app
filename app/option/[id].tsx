import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, type ComponentProps, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatCost, upsizeImageUrl } from '../../lib/format';
import { TIER_LABEL } from '../../lib/recommend';
import { loadWhy, type WhyData } from '../../lib/reasons';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

type State =
  | { status: 'loading' }
  | { status: 'ready'; why: WhyData }
  | { status: 'error' };

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Quiet, per-reason marker inferred from the reason text (display only — does
// not change what reasons are generated). Falls back to a neutral icon.
function reasonIcon(text: string): IoniconName {
  const t = text.toLowerCase();
  if (/budget|afford|cost|cheap|price/.test(t)) return 'wallet-outline';
  if (/time|tonight|min|longer|quick/.test(t)) return 'time-outline';
  if (/effort|easy|easier|work|prep|involved/.test(t)) return 'flash-outline';
  if (/tend to like|you like|favou?rite/.test(t)) return 'heart-outline';
  if (/usual|lane|know|step|further|worth a try/.test(t)) return 'compass-outline';
  return 'restaurant-outline';
}

export default function WhyWeChose() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    setImageUrl(null);
    setImageFailed(false);
    try {
      const why = await loadWhy(id);
      setState({ status: 'ready', why });
      // Meal photo is optional — fetch separately and degrade gracefully.
      supabase
        .from('meals')
        .select('image_url')
        .eq('id', why.mealId)
        .single()
        .then(({ data }) => setImageUrl(data?.image_url ?? null));
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
  const reasons = why.reasons.slice(0, 4);
  const subtitle = why.cuisineLabel
    ? `${why.cuisineLabel} · ${TIER_LABEL[why.tier]}`
    : TIER_LABEL[why.tier];

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
        {imageUrl && !imageFailed ? (
          <Image
            source={{ uri: upsizeImageUrl(imageUrl) }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}

        <View style={styles.header}>
          <Text variant="display">Picked for you — here&apos;s why.</Text>
          <View style={styles.nameBlock}>
            <Text variant="title">{why.name}</Text>
            <Text variant="body" color="textSecondary">
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.reasons}>
          {reasons.map((line, i) => (
            <Fragment key={i}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.reasonRow}>
                <Ionicons name={reasonIcon(line)} size={18} color={colors.textSecondary} />
                <Text variant="body" style={styles.reasonText}>
                  {line}
                </Text>
              </View>
            </Fragment>
          ))}
        </View>

        <Text variant="caption" color="textSecondary">
          {`${why.cookTimeMin} min`} · {formatCost(why.estCost)}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="See what's in it."
          onPress={() =>
            router.push({
              pathname: '/meal/[id]',
              params: { id: why.mealId, option_id: id },
            })
          }
        />
        <View style={styles.backLink}>
          <Text variant="caption" color="accent" onPress={() => router.back()}>
            Back to your three
          </Text>
        </View>
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
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
  },
  header: {
    gap: spacing.lg,
  },
  nameBlock: {
    gap: spacing.xs,
  },
  reasons: {
    // Rows are separated by dividers, not gap.
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  reasonText: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.chipBorder,
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
