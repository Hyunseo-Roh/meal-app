import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { spacing } from '../theme/tokens';

/**
 * First screen for a visitor with no session. Explains Sate in one line and
 * offers two paths. Sign-up is required before onboarding (no anonymous entry):
 * "Sign up" opens account creation; "Log in" routes to the existing-account
 * flow. No identity is minted here.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen style={styles.screen}>
      <View style={styles.block}>
        <Text variant="display">Sate</Text>
        <Text variant="body" color="textSecondary">
          Three meals, picked for your taste — decide in seconds.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Sign up" onPress={() => router.push('/auth/register')} />
        <Pressable
          onPress={() => router.push('/auth/login')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text variant="body" color="textSecondary">
            Log in
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.xl,
  },
  block: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.lg,
  },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
