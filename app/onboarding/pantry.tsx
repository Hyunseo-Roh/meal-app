import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

/**
 * TEMPORARY placeholder — Step 6b only.
 *
 * Taste Setup (step 1) routes here. Becomes the real Pantry Setup (step 2 of 2)
 * in Step 6c. For now it just confirms taste saved and lets you proceed to
 * Screen 3.
 */
export default function PantrySetupPlaceholder() {
  const router = useRouter();

  return (
    <Screen style={styles.screen}>
      <View style={styles.progress}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
      </View>
      <Text variant="caption" color="textSecondary">
        Step 2 of 2 · temporary
      </Text>
      <Text variant="title">Taste saved.</Text>
      <Text variant="body" color="textSecondary">
        Pantry Setup lands here next. For now, on to tonight.
      </Text>
      <View style={styles.footer}>
        <PrimaryButton label="Start." onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  progressActive: {
    backgroundColor: colors.accent,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
