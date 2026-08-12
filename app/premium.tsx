import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PremiumFeatureList } from '../components/PremiumFeatureList';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { colors, spacing } from '../theme/tokens';

/**
 * Post-onboarding soft-sell. Shown AFTER the 3-step onboarding (constraints has
 * already set onboarded = true), so it is non-gating: skippable by [Continue],
 * and killing the app here just resumes at Home next launch. NOT an onboarding
 * step — lives outside app/onboarding/, so the 3-step progress bar is untouched.
 *
 * Renders the same shared PremiumFeatureList as /subscription so the two read
 * identically; [Continue] moves on without upgrading.
 */
export default function PremiumIntro() {
  const router = useRouter();

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
          <Text variant="display">One more thing</Text>
          <Text variant="body" color="textSecondary">
            Premium does what the free app can&apos;t.
          </Text>
        </View>

        <PremiumFeatureList />

        <Text variant="title" style={styles.price}>
          $4.99 a month
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Go Premium" onPress={() => router.push('/subscription')} />
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text variant="body" color="textSecondary">
            Continue
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
  price: {
    marginTop: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
