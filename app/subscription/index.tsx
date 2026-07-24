import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

// Premium is three conveniences on top of a free tier that already solves the
// core problem. One short line each — the screen was a wall of text. Barcode
// scan is the only one that actually runs, so it's the only tappable preview;
// AI Chef and Monthly summary aren't built, so they carry an inline "Coming
// soon" label and no affordance (a dead tap reads as broken).
const FEATURES = [
  {
    icon: 'barcode-outline',
    title: 'Barcode scan',
    line: 'Scan to fill your pantry',
    action: 'scanner',
  },
  {
    icon: 'sparkles-outline',
    title: 'AI Chef',
    line: 'Recipes from your leftovers',
    soon: true,
  },
  {
    icon: 'calendar-outline',
    title: 'Monthly summary',
    line: 'A look back at your month',
    soon: true,
  },
] as const;

export default function Subscription() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable onPress={back} accessibilityLabel="Go back" hitSlop={12} style={styles.backArrow}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Premium</Text>
          <Text variant="body" color="textSecondary">
            {"You've got what you need for free. Premium adds a few conveniences on top."}
          </Text>
          <Text variant="title" style={styles.price}>
            $4.99 a month
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => {
            const inner = (
              <>
                <Ionicons name={f.icon} size={22} color={colors.textSecondary} />
                <View style={styles.featureBody}>
                  <Text variant="body">{f.title}</Text>
                  <Text variant="body" color="textSecondary">
                    {f.line}
                  </Text>
                </View>
                {'action' in f ? (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                ) : (
                  <Text variant="caption" color="textSecondary">
                    Coming soon
                  </Text>
                )}
              </>
            );
            // Barcode scan is the only feature that runs — the sole live preview,
            // so it's the only tappable row. The unbuilt two are plain views.
            return 'action' in f ? (
              <Pressable
                key={f.title}
                onPress={() => router.push('/scanner')}
                accessibilityRole="button"
                accessibilityLabel="Open barcode scanner"
                style={styles.featureRow}
              >
                {inner}
              </Pressable>
            ) : (
              <View key={f.title} style={styles.featureRow}>
                {inner}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Go Premium" onPress={() => router.push('/subscription/payment')} />
        <Pressable
          onPress={() => router.push('/subscription/cancel')}
          accessibilityRole="button"
          style={styles.secondary}
        >
          <Text variant="body" color="textSecondary">
            Cancel subscription
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
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
  price: {
    marginTop: spacing.xs,
  },
  features: {
    gap: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    minHeight: 44,
  },
  featureBody: {
    flex: 1,
    gap: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
