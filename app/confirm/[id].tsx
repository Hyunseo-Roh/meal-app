import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

/**
 * TEMPORARY placeholder — Step 4 only.
 *
 * Confirms the "Make this." action carries the real meal_id through. Replaced
 * by Screen 8 ("Handled") in Step 5, which will set was_selected = true.
 */
export default function ConfirmPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen style={styles.screen}>
      <Text variant="caption" color="textSecondary" style={styles.tag}>
        Temporary · confirm
      </Text>
      <Text variant="title">Make this.</Text>
      <View style={styles.block}>
        <Text variant="caption" color="textSecondary">
          Meal id
        </Text>
        <Text variant="body">{id}</Text>
      </View>
      <Text variant="body" color="textSecondary">
        Next: Screen 8 — Handled.
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
