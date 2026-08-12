import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PremiumFeatureList } from '../../components/PremiumFeatureList';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useSessionGate } from '../../components/RequireSession';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { isPremiumActive } from '../../lib/session';
import { colors, spacing } from '../../theme/tokens';

export default function Subscription() {
  const gate = useSessionGate();
  const router = useRouter();
  // Onboarding hands off here (constraints replaces to /subscription?onboarding=1)
  // instead of a separate screen. In that context there's no prior screen to
  // return to, so we hide the back arrow and offer an explicit "Maybe later" skip.
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Re-read the plan on focus: this screen stays mounted while payment / cancel
  // are pushed on top, so it won't re-render on its own when they flip the flag.
  const [premium, setPremium] = useState(isPremiumActive());
  useFocusEffect(useCallback(() => setPremium(isPremiumActive()), []));

  if (gate) return gate;

  return (
    <Screen>
      {isOnboarding ? null : (
        <Pressable onPress={back} accessibilityLabel="Go back" hitSlop={12} style={styles.backArrow}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Premium</Text>
          <Text variant="body" color="textSecondary">
            {'Premium adds three things: barcode scan, AI Chef, and a monthly summary.'}
          </Text>
          <Text variant="title" style={styles.price}>
            $4.99 a month
          </Text>
        </View>

        <PremiumFeatureList />
      </ScrollView>

      {/* One CTA per plan — never both. Premium can cancel; Free can upgrade. */}
      <View style={styles.footer}>
        {premium ? (
          <Pressable
            onPress={() => router.push('/subscription/cancel')}
            accessibilityRole="button"
            style={styles.secondary}
          >
            <Text variant="body" color="textSecondary">
              Cancel subscription
            </Text>
          </Pressable>
        ) : (
          <PrimaryButton label="Go Premium" onPress={() => router.push('/subscription/payment')} />
        )}
        {isOnboarding ? (
          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            style={styles.secondary}
          >
            <Text variant="body" color="textSecondary">
              Maybe later
            </Text>
          </Pressable>
        ) : null}
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
