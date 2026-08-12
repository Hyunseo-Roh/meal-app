import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

// The premium feature set, shared by the onboarding intro (app/premium.tsx) and
// the /subscription screen so both read identically. Barcode scan is the only one
// that actually runs, so it's the only tappable row (trailing chevron → the
// scanner); AI Chef and Monthly summary aren't built, so they carry an inline
// "Coming soon" label and no affordance.
export const FEATURES = [
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

/**
 * The three premium feature rows. Each row: icon · [title + optional "Coming
 * soon"] over a full-width description · optional trailing chevron.
 *
 * Widow fix: the "Coming soon" label lives on the TITLE line (pushed right), NOT
 * as a sibling of the whole row — so it no longer steals width from the
 * description, which now gets the full column and stays on one line. Rows
 * top-align (alignItems: 'flex-start') so nothing floats when a row is taller.
 */
export function PremiumFeatureList() {
  const router = useRouter();
  return (
    <View style={styles.features}>
      {FEATURES.map((f) => {
        const inner = (
          <>
            <Ionicons name={f.icon} size={22} color={colors.textSecondary} />
            <View style={styles.featureBody}>
              <View style={styles.titleRow}>
                <Text variant="body">{f.title}</Text>
                {'soon' in f ? (
                  <Text variant="caption" color="textSecondary" style={styles.soonLabel}>
                    Coming soon
                  </Text>
                ) : null}
              </View>
              <Text variant="body" color="textSecondary">
                {f.line}
              </Text>
            </View>
            {'action' in f ? (
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            ) : null}
          </>
        );
        // Barcode scan is the only feature that runs — the sole live preview, so
        // it's the only tappable row. The unbuilt two are plain views.
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
  );
}

const styles = StyleSheet.create({
  // Generous vertical separation so the three rows read as distinct, not stacked.
  features: {
    gap: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing.md,
    // Top-align so the icon / chevron sit level with the title, not floating to
    // the vertical middle when a description ever wraps.
    alignItems: 'flex-start',
    minHeight: 44,
  },
  featureBody: {
    flex: 1,
    gap: spacing.xs,
  },
  // Title line: title on the left, "Coming soon" pushed to the right edge.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soonLabel: {
    marginLeft: 'auto',
  },
});
