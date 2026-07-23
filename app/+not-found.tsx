import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { spacing } from '../theme/tokens';

/**
 * The app's own not-found screen. With web `output: 'single'` (SPA), every
 * unknown path serves index.html and expo-router resolves it here — so a
 * nonsense URL lands on this calm screen with a way back, never a raw host 404.
 */
export default function NotFound() {
  const router = useRouter();
  return (
    <Screen style={styles.centered}>
      <Text variant="title">Nothing here</Text>
      <Text variant="body" color="textSecondary">
        That page doesn&apos;t exist.
      </Text>
      <View style={styles.action}>
        <PrimaryButton label="Back to home" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  action: {
    marginTop: spacing.md,
  },
});
