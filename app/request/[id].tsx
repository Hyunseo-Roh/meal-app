import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

/**
 * TEMPORARY placeholder — Step 1 only.
 *
 * Confirms the recommendation_requests insert worked by echoing the real
 * returned request id. Gets replaced by Screen 4 ("Three Options") in Step 2.
 */
export default function RequestPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen style={styles.screen}>
      <Text variant="caption" color="textSecondary" style={styles.tag}>
        Temporary · request created
      </Text>
      <Text variant="title">Handled.</Text>
      <View style={styles.idBlock}>
        <Text variant="caption" color="textSecondary">
          Request id
        </Text>
        <Text variant="body">{id}</Text>
      </View>
      <Text variant="body" color="textSecondary">
        Next: Screen 4 will turn this into three options.
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
  idBlock: {
    gap: spacing.xs,
  },
});
