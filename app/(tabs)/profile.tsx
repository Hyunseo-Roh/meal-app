import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getAuthUser, resetCurrentUser } from '../../lib/currentUser';
import { loadTasteSummary } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

type Account = { email: string | null; isAnonymous: boolean } | null;
type TasteSummary = {
  favoriteCuisine: string | null;
  avoidsCount: number;
  effortLabel: string | null;
  budgetLabel: string | null;
};

export default function Profile() {
  const router = useRouter();
  const [account, setAccount] = useState<Account>(null);
  const [taste, setTaste] = useState<TasteSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Re-read account + taste on every focus so both reflect the latest state
  // after returning from register / login / logout / the taste editor.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [u, summary] = await Promise.all([
          getAuthUser().catch(() => null),
          loadTasteSummary().catch(() => null),
        ]);
        if (!active) return;
        setAccount(u ? { email: u.email, isAnonymous: u.isAnonymous } : null);
        setTaste(summary);
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">Profile</Text>

        {loaded ? (
          <>
            {/* Account */}
            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Account
              </Text>
              {isPermanent ? (
                <>
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

            {/* Taste summary */}
            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Taste
              </Text>
              <View style={styles.summaryRow}>
                <Text variant="body" color="textSecondary">
                  Favorite
                </Text>
                <Text variant="body">{taste?.favoriteCuisine ?? 'Not set'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body" color="textSecondary">
                  Avoids
                </Text>
                <Text variant="body">{`${taste?.avoidsCount ?? 0}`}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body" color="textSecondary">
                  Effort
                </Text>
                <Text variant="body">{taste?.effortLabel ?? 'Not set'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body" color="textSecondary">
                  Budget
                </Text>
                <Text variant="body">{taste?.budgetLabel ?? 'Not set'}</Text>
              </View>
              <Pressable
                onPress={() => router.push('/taste/edit')}
                accessibilityRole="button"
                style={styles.link}
              >
                <Text variant="body" color="accent">
                  Edit taste
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

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
    // column layout: scroll body fills, reset sits at the bottom
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
