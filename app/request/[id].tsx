import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { upsizeImageUrl } from '../../lib/format';
import { getMealBucket } from '../../lib/greeting';
import { loadOptions, type OptionCard } from '../../lib/recommend';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

type State =
  | { status: 'loading' }
  | { status: 'ready'; options: OptionCard[]; createdAt: string | null }
  | { status: 'error' };

// One recommendation card: photo on top (optional, degrades gracefully) + tier,
// name, one short line, and a compact time · price meta.
function RecCard({
  opt,
  imageUrl,
  onPress,
}: {
  opt: OptionCard;
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
        <Text variant="caption" color="textSecondary">
          {`${opt.cook_time_min} min · ≈$${opt.est_cost.toFixed(2)} · ${
            opt.cuisine.charAt(0).toUpperCase() + opt.cuisine.slice(1)
          }`}
        </Text>
        <Text variant="title">{opt.meal}</Text>
        <Text variant="body" color="textSecondary" numberOfLines={2}>
          {opt.explanation}
        </Text>
        {opt.over_time ? (
          <Text variant="caption" color="textSecondary">
            A little longer than usual
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ThreeOptions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  // meal_id -> image_url (photos are optional; fetched after the options load).
  const [images, setImages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    setImages({});
    try {
      const { options, createdAt } = await loadOptions(id);
      setState({ status: 'ready', options, createdAt });
      // Fetch the three photos in one go; missing ones just stay absent.
      supabase
        .from('meals')
        .select('id, image_url')
        .in(
          'id',
          options.map((o) => o.meal_id),
        )
        .then(({ data }) => {
          const map: Record<string, string> = {};
          (data ?? []).forEach((r) => {
            if (r.image_url) map[r.id as string] = r.image_url as string;
          });
          setImages(map);
        });
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
        <Text variant="title">That slipped away.</Text>
        <Text variant="body" color="textSecondary" style={styles.errorBody}>
          We couldn&apos;t pull your three just now. Try once more.
        </Text>
        <View style={styles.retry}>
          <PrimaryButton label="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  // Phrase the heading by the session's meal bucket (from the request time),
  // falling back to now if created_at is somehow missing so it never crashes.
  const bucket = getMealBucket(state.createdAt ? new Date(state.createdAt) : new Date());
  const bucketLabel = bucket.charAt(0).toUpperCase() + bucket.slice(1);

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
          <Text variant="title">{`${bucketLabel}: three suggestions`}</Text>
          <Text variant="body" color="textSecondary">
            Tap one to see why
          </Text>
        </View>

        {state.options.map((opt) => (
          <RecCard
            key={opt.optionId || opt.meal_id}
            opt={opt}
            imageUrl={images[opt.meal_id] ?? null}
            onPress={() => router.push({ pathname: '/option/[id]', params: { id: opt.optionId } })}
          />
        ))}

        <Pressable
          accessibilityRole="button"
          style={styles.backLink}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <Text variant="caption" color="accent">
            Back to start
          </Text>
        </Pressable>
      </ScrollView>
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
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.md,
  },
});
