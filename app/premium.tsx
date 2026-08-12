import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PremiumFeatureList } from '../components/PremiumFeatureList';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { spacing } from '../theme/tokens';

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
        <PrimaryButton label="Continue" onPress={() => router.replace('/')} />
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
  price: {
    marginTop: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
