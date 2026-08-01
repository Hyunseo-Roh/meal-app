import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MealImage } from '../../components/MealImage';
import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { deleteAccount } from '../../lib/account';
import { getAuthUser, resetCurrentUser } from '../../lib/currentUser';
import { formatDate } from '../../lib/format';
import { loadHistory, type HistoryEntry } from '../../lib/history';
import { consumePasswordChanged, isPremiumActive } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../theme/tokens';

// Local onboarded flag (mirrors lib/currentUser.ts). Identity itself lives in
// the Supabase auth session, not AsyncStorage.
const ONBOARDED_KEY = 'app_onboarded';

type SectionStatus = 'loading' | 'ready' | 'error';
type AccountData = { firstName: string | null; lastName: string | null; email: string | null };
type Section<T> = { status: SectionStatus; data: T | null };

// Section header: the 13px uppercase label with a Warm Gray hairline beneath it
// (a DEVIATION from the mockup's 15px serif, which would break serif-≥24). The
// generous space ABOVE comes from the content gap between sections.
function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

// Chevron nav row (pantry "pasta ›" pattern) — Charcoal label, muted chevron.
function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.navRow}>
      <Text variant="body">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  // Account (the header name) and Meals-you've-made load and fail INDEPENDENTLY:
  // a failure in one never hides the others, and only a *successful* empty load
  // shows the empty made-meals line.
  const [account, setAccount] = useState<Section<AccountData>>({ status: 'loading', data: null });
  const [history, setHistory] = useState<Section<HistoryEntry[]>>({
    status: 'loading',
    data: null,
  });
  // Transient "Password updated" confirmation, handed over by the change-password
  // screen via a one-shot flag and consumed on focus. Auto-clears.
  const [pwChanged, setPwChanged] = useState(false);
  // Client-only plan, re-read on focus so it stays coherent with /subscription.
  const [premium, setPremium] = useState(isPremiumActive());
  // Delete account — inline two-step confirm (Alert.alert is unreliable on web).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Per-section loaders. Each keeps prior data on a silent refocus (no loading
  // flash) but shows loading on an explicit retry (when currently errored).
  const loadAccount = useCallback(() => {
    setAccount((p) => (p.status === 'ready' ? p : { status: 'loading', data: null }));
    (async () => {
      const u = await getAuthUser();
      if (!u) throw new Error('no_session');
      const { data } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', u.id)
        .single();
      setAccount({
        status: 'ready',
        data: {
          firstName: ((data?.first_name as string | null) ?? '').trim() || null,
          lastName: ((data?.last_name as string | null) ?? '').trim() || null,
          email: u.email,
        },
      });
    })().catch(() => setAccount({ status: 'error', data: null }));
  }, []);
  const loadMade = useCallback(() => {
    setHistory((p) => (p.status === 'ready' ? p : { status: 'loading', data: null }));
    loadHistory()
      .then((h) => setHistory({ status: 'ready', data: h }))
      .catch(() => setHistory({ status: 'error', data: null }));
  }, []);

  // Re-read on every focus so they reflect the latest state after returning from
  // register / login / logout / the taste editor / a made meal.
  useFocusEffect(
    useCallback(() => {
      loadAccount();
      loadMade();
      setPremium(isPremiumActive());
      // Show the confirmation once, on returning from a successful change.
      if (consumePasswordChanged()) setPwChanged(true);
    }, [loadAccount, loadMade]),
  );

  // Retire the "Password updated" line on its own after a beat.
  useEffect(() => {
    if (!pwChanged) return;
    const t = setTimeout(() => setPwChanged(false), 3000);
    return () => clearTimeout(t);
  }, [pwChanged]);

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
      setDeleteError('Your account didn’t delete');
    }
  }

  const firstName = account.data?.firstName ?? null;
  const email = account.data?.email ?? null;
  const initials =
    (((account.data?.firstName ?? '')[0] ?? '') + ((account.data?.lastName ?? '')[0] ?? ''))
      .toUpperCase() || null;
  const madeCount = history.data?.length ?? 0;

  let madeBody: ReactNode;
  if (history.status === 'loading') {
    madeBody = <LoadingState message="Gathering what you've made…" delayMs={250} />;
  } else if (history.status === 'error') {
    madeBody = <ErrorState message="Your meals didn't come through" onRetry={loadMade} />;
  } else if (madeCount === 0) {
    madeBody = (
      <View style={styles.row}>
        <EmptyState message="Nothing yet — pick a meal and it lands here" />
      </View>
    );
  } else {
    madeBody = (
      <>
        {(history.data ?? []).slice(0, 3).map((e, i) => (
          <Pressable
            key={`${e.mealId}-${e.createdAt}-${i}`}
            onPress={() => router.push({ pathname: '/meal/[id]', params: { id: e.mealId } })}
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, made ${formatDate(e.createdAt)}`}
            style={styles.mealRow}
          >
            <MealImage url={e.imageUrl} width={40} height={40} radius={8} />
            <View style={styles.mealText}>
              <Text variant="body">{e.name}</Text>
              <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                {`${formatDate(e.createdAt)} · ${e.cuisineLabel}`}
              </Text>
            </View>
          </Pressable>
        ))}
        {/* Chevron nav row → the full list. Gated to >3 (a link to already-
            visible content is a dead link); shows the total count. */}
        {madeCount > 3 ? (
          <NavRow label={`See all ${madeCount}`} onPress={() => router.push('/history')} />
        ) : null}
      </>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header: H1 (Literata) + person icon, then the name row. */}
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Ionicons name="person-circle-outline" size={30} color={colors.textSecondary} />
          </View>
          <Text variant="title">Profile</Text>
        </View>

        {/* Name row: initials avatar (Cool Slate fill, Bone initials) + first name,
            with the signed-in email as a small line directly beneath the name (so
            the screen shows which account is signed in without an extra row).
            Shown once the account loads; a load failure just omits it. */}
        {account.status === 'ready' && (initials || firstName || email) ? (
          <View style={styles.nameRow}>
            <View style={styles.avatar}>
              <Text variant="body" color="bg">
                {initials ?? '·'}
              </Text>
            </View>
            <View style={styles.nameText}>
              {firstName ? <Text variant="body">{firstName}</Text> : null}
              {email ? (
                <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ACCOUNT */}
        <View style={styles.section}>
          <SectionHeader label="Account" />
          <NavRow label="Edit taste" onPress={() => router.push('/taste/edit')} />
          <NavRow label="Change password" onPress={() => router.push('/change-password')} />
          {pwChanged ? (
            <Text variant="body" color="textSecondary">
              Password updated
            </Text>
          ) : null}
        </View>

        {/* MEALS YOU'VE MADE */}
        <View style={styles.section}>
          <SectionHeader label="Meals you've made" />
          {madeBody}
        </View>

        {/* SUBSCRIPTION — static, no load. */}
        <View style={styles.section}>
          <SectionHeader label="Subscription" />
          <View style={styles.row}>
            <Text variant="body" color="textSecondary">
              Plan
            </Text>
            <Text variant="body">{premium ? 'Premium' : 'Free'}</Text>
          </View>
          <NavRow label="See Premium" onPress={() => router.push('/subscription')} />
        </View>

        {/* LOG OUT — its own row, set apart by a hairline above with clear space,
            so it's never lost against Change password. */}
        <View style={styles.logoutZone}>
          <Pressable onPress={signOutToStart} accessibilityRole="button" style={styles.row}>
            <Text variant="body" color="accent">
              Log out
            </Text>
          </Pressable>
        </View>

        {/* DELETE ACCOUNT — alone at the very bottom, in clay (destructive). */}
        <View style={styles.deleteZone}>
          {!confirmingDelete ? (
            <Pressable
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
              style={styles.link}
            >
              <Text variant="body" color="error">
                Delete account
              </Text>
            </Pressable>
          ) : (
            <View style={styles.deleteConfirm}>
              <Text variant="caption" color="textSecondary" style={styles.warning}>
                This permanently removes your taste and pantry, and this email can&apos;t be used to
                sign up again. You can&apos;t undo this.
              </Text>
              {/* The destructive confirm reads in clay; the explicit two-step tap
                  is the safeguard. */}
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                accessibilityRole="button"
                style={styles.link}
              >
                <Text variant="body" color="error">
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
              {deleteError ? (
                <Text variant="body" color="error">
                  {deleteError}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Page-title icon treatment (shared across Pantry/Profile/Home): a 30px
  // decorative Ionicon centered in a 44×44 box, on a row with the title.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    // Large gap BETWEEN sections — this is what groups them (no card surfaces).
    gap: spacing.xl,
  },
  // Name row under the H1: avatar + first name.
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Pull it up toward the H1 (the content gap would otherwise float it away).
    marginTop: -spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Name stacked above the small email line, beside the avatar.
  nameText: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  // Section = header + tight rows. gap 0 so the rows abut (the section header
  // carries its own space below); the content gap (24) separates whole sections.
  section: {
    gap: 0,
  },
  // 13px label + Warm Gray hairline beneath, with room under the line before the
  // rows so it reads as a header rather than another row.
  sectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.chipBorder,
    paddingBottom: spacing.xs,
    marginBottom: spacing.sm,
  },
  // A label/value row. minHeight keeps the tap target; rows abut for a tight rhythm.
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  // Chevron nav row.
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  // Made-meal preview row: 40px thumbnail left, text block right, centered.
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  // Name stacked above the date·cuisine caption, beside the thumbnail.
  mealText: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
    justifyContent: 'center',
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
  // Log out set apart: hairline above + clear space, so it never sits adjacent
  // to Change password at the same weight.
  logoutZone: {
    borderTopWidth: 1,
    borderTopColor: colors.chipBorder,
    paddingTop: spacing.md,
  },
  // Destructive delete flow sits alone at the very bottom, with generous space
  // above (on top of the content gap) so it never reads at preference weight.
  deleteZone: {
    marginTop: spacing.lg,
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
