import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { resetUpdateErrorMessage } from '../../lib/authErrors';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

// Matches the signup minimum (auth/register.tsx) — not a new rule.
const MIN_PASSWORD = 6;

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Reset-password — STEP 2 of the recovery flow: set a new password.
 *
 * The client is configured with detectSessionInUrl:false (see lib/supabase.ts),
 * so we establish the recovery session by hand instead of relying on auto-parse:
 *   - implicit flow: tokens arrive in the URL hash (#access_token&refresh_token
 *     &type=recovery) → setSession
 *   - PKCE flow: a ?code= query param → exchangeCodeForSession
 * We also listen for the PASSWORD_RECOVERY event as a belt-and-suspenders check.
 * With a valid recovery session, updateUser({ password }) sets the new password.
 *
 * Native has no landing URL, so recovery is web-only; on native (or a stale /
 * tokenless link) we show a calm "link expired" state that routes back to the
 * request screen — never a dead end.
 */
export default function ResetPassword() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidNext, setInvalidNext] = useState(false);
  const [invalidConfirm, setInvalidConfirm] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let active = true;

    // A PASSWORD_RECOVERY event (or any recovery session that lands) flips us to
    // the form. Registered before we parse the URL so nothing is missed.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') setPhase('ready');
    });

    (async () => {
      // Native: no URL to carry a token — recovery is a web-only affordance.
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        if (active) setPhase('invalid');
        return;
      }
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        const code = url.searchParams.get('code');

        if (access_token && refresh_token) {
          // Implicit flow — set the session from the hash tokens.
          const { error: err } = await supabase.auth.setSession({ access_token, refresh_token });
          if (active) setPhase(err ? 'invalid' : 'ready');
        } else if (code) {
          // PKCE flow — exchange the code for a session.
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (active) setPhase(err ? 'invalid' : 'ready');
        } else {
          // No token in the URL. Maybe the SDK already has a recovery session
          // (or the event fires momentarily); otherwise this link is stale.
          const { data } = await supabase.auth.getSession();
          if (active && !data.session) setPhase('invalid');
          // If a session exists, wait for the event / leave as 'checking' briefly;
          // fall back to 'ready' so a valid session is never stranded.
          if (active && data.session) setPhase('ready');
        }
      } catch {
        if (active) setPhase('invalid');
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSave() {
    setError(null);
    setInvalidNext(false);
    setInvalidConfirm(false);
    if (next.length < MIN_PASSWORD) {
      setInvalidNext(true);
      setError('Your password needs at least 6 characters');
      return;
    }
    if (next !== confirm) {
      setInvalidConfirm(true);
      setError('Passwords don’t match');
      return;
    }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password: next });
    if (err) {
      setSubmitting(false);
      // weak_password → new field; same_password → new field too (it's the new one).
      setInvalidNext(true);
      setError(resetUpdateErrorMessage(err));
      return;
    }
    // Success. Drop the recovery session so the next step is a clean log-in with
    // the new password, then show the confirmation.
    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort; the password is already updated.
    }
    setSubmitting(false);
    setPhase('done');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'checking' ? (
          <View style={styles.header}>
            <Text variant="title">One moment…</Text>
            <Text variant="body" color="textSecondary">
              Checking your reset link.
            </Text>
          </View>
        ) : null}

        {phase === 'invalid' ? (
          <View style={styles.header}>
            <Text variant="title">This link has expired</Text>
            <Text variant="body" color="textSecondary">
              Reset links only work once and for a short while. Request a fresh one to continue.
            </Text>
          </View>
        ) : null}

        {phase === 'done' ? (
          <View style={styles.header}>
            <Text variant="title">Password updated</Text>
            <Text variant="body" color="textSecondary">
              Log in with your new password.
            </Text>
          </View>
        ) : null}

        {phase === 'ready' ? (
          <>
            <View style={styles.header}>
              <Text variant="title">Set a new password</Text>
              <Text variant="body" color="textSecondary">
                Choose a new password for your account.
              </Text>
            </View>

            <View style={styles.field}>
              <Text variant="caption" color="textSecondary">
                New password
              </Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={next}
                  onChangeText={(t) => {
                    setNext(t);
                    if (invalidNext) setInvalidNext(false);
                  }}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showNext}
                  autoCapitalize="none"
                  editable={!submitting}
                  style={[styles.input, styles.inputWithIcon, invalidNext && styles.inputError]}
                />
                <Pressable
                  onPress={() => setShowNext((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showNext ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  style={styles.eye}
                >
                  <Ionicons
                    name={showNext ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text variant="caption" color="textSecondary">
                Confirm new password
              </Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={confirm}
                  onChangeText={(t) => {
                    setConfirm(t);
                    if (invalidConfirm) setInvalidConfirm(false);
                  }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  editable={!submitting}
                  style={[styles.input, styles.inputWithIcon, invalidConfirm && styles.inputError]}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  style={styles.eye}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {error ? (
              <Text variant="body" color="error">
                {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {phase === 'ready' ? (
          <PrimaryButton
            label={submitting ? 'One moment…' : 'Update password'}
            onPress={handleSave}
            disabled={submitting}
          />
        ) : null}
        {phase === 'invalid' ? (
          <PrimaryButton
            label="Request a new link"
            onPress={() => router.replace('/auth/forgot-password')}
          />
        ) : null}
        {phase === 'done' ? (
          <PrimaryButton label="Log in" onPress={() => router.replace('/auth/login')} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 0,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: 2,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    height: 52,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  passwordWrap: {
    justifyContent: 'center',
  },
  inputWithIcon: {
    paddingRight: spacing.xl + spacing.lg,
  },
  eye: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
