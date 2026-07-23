import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { deleteAccount } from '../../lib/account';
import { getAuthUser, resetCurrentUser } from '../../lib/currentUser';
import { formatDate } from '../../lib/format';
import { loadHistory, type HistoryEntry } from '../../lib/history';
import { loadTasteSummary } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

type SectionStatus = 'loading' | 'ready' | 'error';
type AccountData = { email: string | null };
type TasteSummary = {
  favoriteCuisines: string[];
  avoids: string[];
  effortLabel: string | null;
  budgetLabel: string | null;
};
type Section<T> = { status: SectionStatus; data: T | null };

export default function Profile() {
  const router = useRouter();
  // Each section (Account / Taste / Meals you've made) loads and fails
  // INDEPENDENTLY: a failure in one must never hide the others, and — critically
  // — must never render a value that looks like real data (an errored taste load
  // showing "Not set" would read as "you never set a taste", which is a lie). So
  // a failed section shows its own error + retry, and only a *successful* empty
  // load shows "Not set" / the empty made-meals line.
  const [account, setAccount] = useState<Section<AccountData>>({ status: 'loading', data: null });
  const [taste, setTaste] = useState<Section<TasteSummary>>({ status: 'loading', data: null });
  const [history, setHistory] = useState<Section<HistoryEntry[]>>({
    status: 'loading',
    data: null,
  });
  // Delete account — inline two-step confirm (Alert.alert is unreliable on web).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Per-section loaders. Each keeps prior data on a silent refocus (no loading
  // flash) but shows loading on an explicit retry (when currently errored).
  const loadAccount = useCallback(() => {
    setAccount((p) => (p.status === 'ready' ? p : { status: 'loading', data: null }));
    getAuthUser()
      .then((u) => setAccount({ status: 'ready', data: { email: u?.email ?? null } }))
      .catch(() => setAccount({ status: 'error', data: null }));
  }, []);
  const loadTaste = useCallback(() => {
    setTaste((p) => (p.status === 'ready' ? p : { status: 'loading', data: null }));
    loadTasteSummary()
      .then((s) => setTaste({ status: 'ready', data: s }))
      .catch(() => setTaste({ status: 'error', data: null }));
  }, []);
  const loadMade = useCallback(() => {
    setHistory((p) => (p.status === 'ready' ? p : { status: 'loading', data: null }));
    loadHistory()
      .then((h) => setHistory({ status: 'ready', data: h }))
      .catch(() => setHistory({ status: 'error', data: null }));
  }, []);

  // Re-read all three on every focus so they reflect the latest state after
  // returning from register / login / logout / the taste editor / a made meal.
  useFocusEffect(
    useCallback(() => {
      loadAccount();
      loadTaste();
      loadMade();
    }, [loadAccount, loadTaste, loadMade]),
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

        {/* Settings screen: no card surfaces. Grouping comes from whitespace
            (large gaps between sections, tight rows within) + hairlines that
            appear ONLY between rows inside a section, never between sections.
            Each data section owns its loading / error / ready state. */}

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Account
          </Text>
          {account.status === 'loading' ? (
            <LoadingState message="Loading…" />
          ) : account.status === 'error' ? (
            <ErrorState message="Couldn't load your account." onRetry={loadAccount} />
          ) : (
            <>
              {account.data?.email ? (
                <View style={styles.row}>
                  <Text variant="body">{account.data.email}</Text>
                </View>
              ) : null}
              <Pressable
                onPress={signOutToStart}
                accessibilityRole="button"
                style={[styles.row, account.data?.email ? styles.divider : null]}
              >
                <Text variant="body" color="accent">
                  Log out
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* TASTE */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Taste
          </Text>
          {taste.status === 'loading' ? (
            <LoadingState message="Loading…" />
          ) : taste.status === 'error' ? (
            <ErrorState message="Couldn't load your taste." onRetry={loadTaste} />
          ) : (
            <>
              <View style={styles.row}>
                <Text variant="body" color="textSecondary">
                  Favorite
                </Text>
                <Text variant="body">
                  {taste.data && taste.data.favoriteCuisines.length > 0
                    ? taste.data.favoriteCuisines.join(' · ')
                    : 'Not set'}
                </Text>
              </View>
              <View style={[styles.row, styles.divider]}>
                <Text variant="body" color="textSecondary">
                  Avoids
                </Text>
                <Text variant="body">
                  {taste.data && taste.data.avoids.length > 0
                    ? taste.data.avoids.join(' · ')
                    : 'None'}
                </Text>
              </View>
              <View style={[styles.row, styles.divider]}>
                <Text variant="body" color="textSecondary">
                  Effort
                </Text>
                <Text variant="body">{taste.data?.effortLabel ?? 'Not set'}</Text>
              </View>
              <View style={[styles.row, styles.divider]}>
                <Text variant="body" color="textSecondary">
                  Budget
                </Text>
                <Text variant="body">{taste.data?.budgetLabel ?? 'Not set'}</Text>
              </View>
              <Pressable
                onPress={() => router.push('/taste/edit')}
                accessibilityRole="button"
                style={[styles.navRow, styles.divider]}
              >
                <Text variant="body">Edit taste</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </>
          )}
        </View>

        {/* SUBSCRIPTION — static, no load. */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Subscription
          </Text>
          <View style={styles.row}>
            <Text variant="body" color="textSecondary">
              Plan
            </Text>
            <Text variant="body">Free</Text>
          </View>
          <Pressable
            onPress={() => router.push('/subscription')}
            accessibilityRole="button"
            style={[styles.navRow, styles.divider]}
          >
            <Text variant="body">See Premium</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* MEALS YOU'VE MADE */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Meals you&apos;ve made
          </Text>
          {history.status === 'loading' ? (
            <LoadingState message="Loading…" />
          ) : history.status === 'error' ? (
            <ErrorState message="Couldn't load your meals." onRetry={loadMade} />
          ) : (history.data?.length ?? 0) === 0 ? (
            <View style={styles.row}>
              <EmptyState message="Nothing yet — pick a meal and it lands here" />
            </View>
          ) : (
            <>
              {(history.data ?? []).slice(0, 3).map((e, i) => (
                <Pressable
                  key={`${e.mealId}-${e.createdAt}-${i}`}
                  onPress={() => router.push({ pathname: '/meal/[id]', params: { id: e.mealId } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.name}, made ${formatDate(e.createdAt)}`}
                  style={[styles.mealRow, i > 0 ? styles.divider : null]}
                >
                  <Text variant="body">{e.name}</Text>
                  <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                    {`${formatDate(e.createdAt)} · ${e.cuisineLabel}`}
                  </Text>
                </Pressable>
              ))}
              {/* Chevron nav row (pantry "pasta ›" pattern) → the full list.
                  Gated to >3: a link to already-visible content is a dead link. */}
              {(history.data?.length ?? 0) > 3 ? (
                <Pressable
                  onPress={() => router.push('/history')}
                  accessibilityRole="button"
                  style={[styles.navRow, styles.divider]}
                >
                  <Text variant="body">See all</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>

            {/* Delete account — outside every section, on its own, with generous
                space above so a destructive action never sits at preference weight. */}
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
    // Large gap BETWEEN sections — this is what groups them (no card surfaces).
    gap: spacing.xl,
  },
  // Caption sits just above its rows; rows themselves are tight (see `row`).
  section: {
    gap: spacing.sm,
  },
  // A label/value or action row. Tight vertical rhythm; the divider (below) is
  // added only to rows that follow another row in the same section.
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  // Chevron nav row — the pantry "pasta ›" pattern. Charcoal label, muted chevron.
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  // Made-meal preview row: name stacked above the date·cuisine caption.
  mealRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  // Hairline BETWEEN ROWS within a section only — never between sections.
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.chipBorder,
  },
  // Meta is data, not a label — drop the caption role's uppercase + tracking.
  dataCaption: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  // Destructive delete flow sits alone, on the Bone background, with generous
  // space above (on top of the content gap) so it never reads at the same
  // visual weight as a preference row.
  deleteZone: {
    marginTop: spacing.xl,
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
