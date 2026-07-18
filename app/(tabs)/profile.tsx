import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { deleteAccount } from '../../lib/account';
import { getAuthUser, resetCurrentUser } from '../../lib/currentUser';
import { loadTasteSummary } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

type Account = { email: string | null } | null;
type TasteSummary = {
  favoriteCuisines: string[];
  avoids: string[];
  effortLabel: string | null;
  budgetLabel: string | null;
};

export default function Profile() {
  const router = useRouter();
  const [account, setAccount] = useState<Account>(null);
  const [taste, setTaste] = useState<TasteSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Delete account — inline two-step confirm (Alert.alert is unreliable on web).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        setAccount(u ? { email: u.email } : null);
        setTaste(summary);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Sign out, clear the memo + onboarded flag, and return to the splash, which
  // resolves a no-session user to Welcome. Sign-up is required to re-enter.
  async function signOutToStart() {
    try {
      await supabase.auth.signOut();
      resetCurrentUser();
      await AsyncStorage.removeItem(ONBOARDED_KEY);
    } catch {
      // best-effort; still route to the splash
    }
    router.replace('/');
  }

  // Permanently remove the user's data (atomic RPC) then tear down the session.
  // On failure we surface a note and stay put — never half-deleted + locked out.
  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      router.replace('/');
    } catch {
      setDeleting(false);
      setDeleteError('Couldn’t delete your account. Try again.');
    }
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">Profile</Text>

        {loaded ? (
          <>
            {/* Account — every user is a real, signed-in account. */}
            <View style={styles.section}>
              <Text variant="caption" color="textSecondary">
                Account
              </Text>
              {account?.email ? <Text variant="body">{account.email}</Text> : null}
              <Pressable onPress={signOutToStart} accessibilityRole="button" style={styles.link}>
                <Text variant="body" color="accent">
                  Log out
                </Text>
              </Pressable>
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
                <Text variant="body">
                  {taste && taste.favoriteCuisines.length > 0
                    ? taste.favoriteCuisines.join(' · ')
                    : 'Not set'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body" color="textSecondary">
                  Avoids
                </Text>
                <Text variant="body">
                  {taste && taste.avoids.length > 0 ? taste.avoids.join(' · ') : 'None'}
                </Text>
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

            {/* Delete account — low-emphasis, at the bottom, its own quiet zone. */}
            <View style={styles.deleteZone}>
              {!confirmingDelete ? (
                <Pressable
                  onPress={() => setConfirmingDelete(true)}
                  accessibilityRole="button"
                  style={styles.link}
                >
                  <Text variant="body" color="textSecondary">
                    Delete account
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.deleteConfirm}>
                  <Text variant="caption" color="textSecondary" style={styles.warning}>
                    This permanently removes your taste and pantry. You can&apos;t undo this.
                  </Text>
                  {/* Destructive action kept quiet (muted, no accent/blue). We can't
                      use a warning color; the explicit confirm tap is the safeguard. */}
                  <Pressable
                    onPress={handleDelete}
                    disabled={deleting}
                    accessibilityRole="button"
                    style={styles.link}
                  >
                    <Text variant="body" color="textSecondary">
                      {deleting ? 'Deleting…' : 'Delete permanently'}
                    </Text>
                  </Pressable>
                  {/* Cancel is the safe default — the present (accent) action. */}
                  <Pressable
                    onPress={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    accessibilityRole="button"
                    style={styles.link}
                  >
                    <Text variant="body" color="accent">
                      Cancel
                    </Text>
                  </Pressable>
                  {deleteError ? <Text variant="body">{deleteError}</Text> : null}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
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
  // Quiet bottom zone for the destructive delete flow — a hairline + padding
  // separate it from the Taste section above.
  deleteZone: {
    borderTopWidth: 1,
    borderTopColor: colors.chipBorder,
    paddingTop: spacing.md,
  },
  deleteConfirm: {
    gap: spacing.sm,
  },
  warning: {
    // Supporting sentence at 13/secondary — drop the caption role's uppercase + tracking.
    textTransform: 'none',
    letterSpacing: 0,
  },
});
