import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

/**
 * TEMPORARY placeholder — Step 3 only.
 *
 * Confirms the "See what's in it." action carries the real meal_id through.
 * Replaced by Screen 7 ("Meal Detail + Gap") in Step 4.
 */
export default function MealPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen style={styles.screen}>
      <Text variant="caption" color="textSecondary" style={styles.tag}>
        Temporary · meal detail
      </Text>
      <Text variant="title">What&apos;s in it.</Text>
      <View style={styles.block}>
        <Text variant="caption" color="textSecondary">
          Meal id
        </Text>
        <Text variant="body">{id}</Text>
      </View>
      <Text variant="body" color="textSecondary">
        Next: Screen 7 — the Gap Tracker.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tag: {
    marginBottom: spacing.sm,
  },
  block: {
    gap: spacing.xs,
  },
});
