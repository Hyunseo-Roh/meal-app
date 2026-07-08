import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { colors, spacing } from '../theme/tokens';

// Locked premium placeholders — same pattern/tokens as the Pantry cards. No
// entitlement check, no payment; purely a soft introduction.
const PREMIUM = [
  { key: 'ai', title: 'AI Chef', subtitle: 'Turn what you have into new ideas.' },
  { key: 'scan', title: 'Barcode scan', subtitle: 'Scan packages to add them instantly.' },
] as const;

/**
 * Post-onboarding soft-sell. Shown AFTER the 3-step onboarding (constraints has
 * already set onboarded = true), so it is non-gating: skippable by [Continue],
 * and killing the app here just resumes at Home next launch. NOT an onboarding
 * step — lives outside app/onboarding/, so the 3-step progress bar is untouched.
 */
export default function PremiumIntro() {
  const router = useRouter();
  const [comingSoon, setComingSoon] = useState(false);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="display">One more thing</Text>
          <Text variant="body" color="textSecondary">
            Premium adds a little more, when you want it. You&apos;re all set without it.
          </Text>
        </View>

        <View style={styles.cards}>
          {PREMIUM.map((card) => (
            <View key={card.key} style={styles.premiumCard}>
              <Ionicons
                name="lock-closed"
                size={20}
                color={colors.textSecondary}
                style={styles.lock}
              />
              <View style={styles.premiumBody}>
                <View style={styles.premiumTitleRow}>
                  <Text variant="body">{card.title}</Text>
                  <View style={styles.badge}>
                    <Text variant="caption" color="textSecondary">
                      Premium
                    </Text>
                  </View>
                </View>
                <Text variant="body" color="textSecondary">
                  {card.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setComingSoon(true)}
          accessibilityRole="button"
          style={styles.unlock}
        >
          <Text variant="body" color="accent">
            Unlock with Premium
          </Text>
        </Pressable>
        {comingSoon ? (
          <Text variant="body" color="textSecondary">
            Coming soon
          </Text>
        ) : null}
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
  cards: {
    gap: spacing.md,
  },
  premiumCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  lock: {
    marginTop: spacing.xs,
  },
  premiumBody: {
    flex: 1,
    gap: spacing.xs,
  },
  premiumTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unlock: {
    minHeight: 44,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
