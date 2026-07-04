import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getAuthUser, resetCurrentUser } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

type Account = { email: string | null; isAnonymous: boolean } | null;

export default function Taste() {
  const router = useRouter();
  const [account, setAccount] = useState<Account>(null);
  const [loaded, setLoaded] = useState(false);

  // Re-read the auth user on every focus so the section reflects the latest state
  // after returning from register / login / logout.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const u = await getAuthUser().catch(() => null);
        if (!active) return;
        setAccount(u ? { email: u.email, isAnonymous: u.isAnonymous } : null);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Sign out of the current session (anon or permanent), clear the memo + onboarded
  // flag, and return to onboarding — a fresh anonymous user is minted on next entry.
  async function signOutToStart() {
    try {
      await supabase.auth.signOut();
      resetCurrentUser();
      await AsyncStorage.removeItem(ONBOARDED_KEY);
    } catch {
      // best-effort; still route to onboarding
    }
    router.replace('/onboarding/taste');
  }

  const isPermanent = loaded && account !== null && !account.isAnonymous;

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.block}>
          <Text variant="title">Your Taste</Text>
          <Text variant="caption" color="textSecondary">
            What you like, learned over time.
          </Text>
        </View>

        {loaded ? (
          <View style={styles.account}>
            {isPermanent ? (
              <>
                <Text variant="caption" color="textSecondary">
                  Signed in as
                </Text>
                <Text variant="body">{account?.email}</Text>
                <Pressable onPress={signOutToStart} accessibilityRole="button" style={styles.link}>
                  <Text variant="body" color="accent">
                    Log out
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <PrimaryButton
                  label="Save your account"
                  onPress={() => router.push('/auth/register')}
                />
                <Pressable
                  onPress={() => router.push('/auth/login')}
                  accessibilityRole="button"
                  style={styles.link}
                >
                  <Text variant="body" color="accent">
                    Already have an account? Log in
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>

      <Pressable onPress={signOutToStart} accessibilityLabel="Start over" style={styles.reset}>
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
    gap: spacing.xl,
  },
  block: {
    gap: spacing.sm,
  },
  account: {
    gap: spacing.md,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  reset: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
