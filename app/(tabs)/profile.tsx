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
import { deleteHistoryEntry, loadHistory, type HistoryEntry } from '../../lib/history';
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

// Label/value chevron row (muted label · Charcoal value · chevron) — the "Edit
// taste ›" pattern with a value shown, tappable to edit.
function NavValueRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.navRow}>
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      <View style={styles.valueGroup}>
        <Text variant="body" style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

// Read-only label/value row (muted label · Charcoal value, no chevron).
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      <Text variant="body" style={[styles.value, styles.readonlyValue]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * One made-meal row with a reliable trailing delete control. Swipe-to-delete via
 * PanResponder proved un-drivable/unverifiable on web here (same as the filter
 * bar), and react-native-gesture-handler/reanimated aren't wired — so rather than
 * ship a possibly-dead swipe, delete lives in a trailing trash affordance: tap it
 * to arm a clay "Delete" confirm (auto-disarms after a few seconds), tap that to
 * remove. Tapping the row's thumbnail/name still navigates, untouched. The parent
 * owns the optimistic removal + revert.
 */
function MadeMealRow({
  entry,
  onNavigate,
  onDelete,
}: {
  entry: HistoryEntry;
  onNavigate: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // Auto-disarm the confirm so a stray tap can't leave a live Delete sitting there.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <View style={styles.mealRow}>
      <Pressable
        onPress={onNavigate}
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}, made ${formatDate(entry.createdAt)}`}
        style={styles.mealTap}
      >
        <MealImage url={entry.imageUrl} width={40} height={40} radius={8} />
        <View style={styles.mealText}>
          <Text variant="body">{entry.name}</Text>
          <Text variant="caption" color="textSecondary" style={styles.dataCaption}>
            {`${formatDate(entry.createdAt)} · ${entry.cuisineLabel}`}
          </Text>
        </View>
      </Pressable>

      {confirming ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Confirm delete ${entry.name}`}
          style={styles.confirmDelete}
        >
          <Text variant="caption" color="bg" style={styles.confirmDeleteText}>
            Delete
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setConfirming(true)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.name}`}
          hitSlop={10}
          style={styles.trashBtn}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
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
  // Swipe-to-delete a made-meal entry: a transient note if the remove fails.
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  // Swipe-to-delete: optimistically drop the entry (the row unmounts and the
  // "See all N" count decrements immediately), then call the auth.uid()-guarded
  // RPC. On failure, revert and surface a small note. Another user's entries are
  // untouched — the function only deletes a request owned by auth.uid().
  const removeHistoryEntry = useCallback(
    async (entry: HistoryEntry) => {
      setHistoryError(null);
      const prev = history.data ?? [];
      setHistory({ status: 'ready', data: prev.filter((e) => e.requestId !== entry.requestId) });
      try {
        await deleteHistoryEntry(entry.requestId);
      } catch {
        setHistory({ status: 'ready', data: prev }); // revert
        setHistoryError('Couldn’t remove that');
      }
    },
    [history.data],
  );

  const firstName = account.data?.firstName ?? null;
  const email = account.data?.email ?? null;
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
        {(history.data ?? []).slice(0, 3).map((e) => (
          <MadeMealRow
            key={e.requestId}
            entry={e}
            onNavigate={() => router.push({ pathname: '/meal/[id]', params: { id: e.mealId } })}
            onDelete={() => removeHistoryEntry(e)}
          />
        ))}
        {historyError ? (
          <Text variant="body" color="error" style={styles.historyError}>
            {historyError}
          </Text>
        ) : null}
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

        {/* ACCOUNT — name (editable) + email (read-only) merged in here, above the
            editors. No second avatar; the page header above is the only icon. */}
        <View style={styles.section}>
          <SectionHeader label="Account" />
          {/* Shown once the account loads; a load failure just omits these two and
              leaves the editors below usable. */}
          {account.status === 'ready' ? (
            <>
              {/* Name → the name editor; writes users.first_name (the greeting). */}
              <NavValueRow
                label="Name"
                value={firstName ?? 'Not set'}
                onPress={() => router.push('/name/edit')}
              />
              {/* Email is the auth login identifier — read-only (changing it needs a
                  reauth/verify flow, out of scope). */}
              {email ? <ValueRow label="Email" value={email} /> : null}
            </>
          ) : null}
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
  // Shared header layout (matches Home/Pantry): icon + serif title. The icon box
  // is the glyph's size (not a wider 44px box) so it sits flush at the 24px
  // content margin instead of indented by the box's centring slack.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    // Large gap BETWEEN sections — this is what groups them (no card surfaces).
    gap: spacing.xl,
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
  // Trailing value + chevron group on a NavValueRow; shrinks so a long value
  // truncates instead of pushing the label.
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  // The value text (right-aligned, Charcoal); truncates on overflow.
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  // Read-only value (no chevron beside it) keeps a gap from the label.
  readonlyValue: {
    marginLeft: spacing.md,
  },
  historyError: {
    marginTop: spacing.sm,
  },
  // Made-meal preview row: tappable thumbnail+text (flex) left, delete control right.
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  // The navigable part of the row (thumbnail + text).
  mealTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Trailing trash affordance (idle).
  trashBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Armed clay Delete confirm (destructive).
  confirmDelete: {
    backgroundColor: colors.error,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    // Drop the caption role's uppercase + tracking — a compact button label.
    textTransform: 'none',
    letterSpacing: 0,
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
