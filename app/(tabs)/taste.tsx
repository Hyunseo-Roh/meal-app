import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

export default function Taste() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.block}>
        <Text variant="title">Your Taste</Text>
        <Text variant="caption" color="textSecondary">
          What you like, learned over time.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  block: {
    gap: spacing.sm,
  },
});
