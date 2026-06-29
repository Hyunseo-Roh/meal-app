import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

export default function History() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.block}>
        <Text variant="title">History</Text>
        <Text variant="caption" color="textSecondary">
          Your past picks will live here.
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
