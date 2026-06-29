import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { spacing } from '../../theme/tokens';

// Same AsyncStorage keys used in lib/currentUser.ts (STORAGE_KEY / ONBOARDED_KEY).
const USER_ID_KEY = 'app_user_id';
const ONBOARDED_KEY = 'app_onboarded';

export default function Taste() {
  const router = useRouter();

  // Hidden demo utility: wipe the local identity + onboarded flag so the next
  // entry behaves like a fresh first launch, then jump to onboarding.
  async function resetDemo() {
    try {
      await AsyncStorage.multiRemove([USER_ID_KEY, ONBOARDED_KEY]);
    } catch {
      // best-effort; still route to onboarding
    }
    router.replace('/onboarding/taste');
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.block}>
          <Text variant="title">Your Taste</Text>
          <Text variant="caption" color="textSecondary">
            What you like, learned over time.
          </Text>
        </View>
      </View>

      <Pressable onPress={resetDemo} accessibilityLabel="Reset demo" style={styles.reset}>
        <Text variant="caption" color="textSecondary">
          Start over
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    // column layout: body fills, reset sits at the bottom
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  block: {
    gap: spacing.sm,
  },
  reset: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
