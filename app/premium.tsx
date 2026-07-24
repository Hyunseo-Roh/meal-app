import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
 * One merged card (same treatment as the Pantry premium card) that routes to
 * /subscription for the detail — cheaper than reproducing the pantry popup here.
 */
export default function PremiumIntro() {
  const router = useRouter();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="display">One more thing</Text>
          <Text variant="body" color="textSecondary">
            The app works free — Premium adds a couple of conveniences on top.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/subscription')}
          accessibilityRole="button"
          accessibilityLabel="Barcode scan and AI Chef — see Premium"
          style={styles.premiumCard}
        >
          <View style={styles.premiumBody}>
            <View style={styles.badge}>
              <Text variant="caption" color="textSecondary">
                Premium
              </Text>
            </View>
            <Text variant="body">Barcode scan and AI Chef</Text>
            <Text variant="body" color="textSecondary">
              Conveniences on top of the free app
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
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
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center', // vertically centers the chevron against the content column
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  premiumBody: {
    flex: 1,
    gap: spacing.xs,
  },
  badge: {
    // Hug the label instead of stretching to the column width.
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
