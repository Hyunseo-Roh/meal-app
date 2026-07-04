import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { resetCurrentUser } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

export default function Taste() {
  const router = useRouter();

  // Hidden demo utility: drop the anonymous session + clear the onboarded flag so
  // the next entry behaves like a fresh first launch (a new anon user is minted),
  // then jump to onboarding.
  async function resetDemo() {
    try {
      await supabase.auth.signOut(); // drop the current anonymous session
      resetCurrentUser(); // clear the in-memory identity memo
      await AsyncStorage.removeItem(ONBOARDED_KEY); // send them back through onboarding
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
