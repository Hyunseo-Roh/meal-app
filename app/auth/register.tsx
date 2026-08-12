import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { authErrorMessage, isEmailInUse } from '../../lib/authErrors';
import { setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

export default function Register() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which field to mark invalid (clay border + fill). Validation is sequential,
  // so at most one is wrong at a time; server errors map to email or password.
  const [errorField, setErrorField] = useState<
    'first' | 'last' | 'email' | 'password' | 'confirm' | null
  >(null);
  const [emailInUse, setEmailInUse] = useState(false);
  // Non-functional social sign-in: tapping shows a calm "coming soon" note,
  // same pattern as the Pantry premium cards. No OAuth is wired.
  const [comingSoon, setComingSoon] = useState(false);
  // Per-field password visibility (display only — no auth logic).
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSave() {
    setError(null);
    setErrorField(null);
    setEmailInUse(false);
    // Fast client-side pre-checks. The <6 check is only a pre-check; server
    // password errors are surfaced verbatim below (never overwritten).
    if (!firstName.trim()) {
      setErrorField('first');
      setError('Enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setErrorField('last');
      setError('Enter your last name');
      return;
    }
    if (!email.trim()) {
      setErrorField('email');
      setError('Enter your email');
      return;
    }
    if (password.length < 6) {
      setErrorField('password');
      setError('Your password needs at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setErrorField('confirm');
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    // Create a real account. signUp inserts one row into auth.users, which fires
    // the on_auth_user_created trigger to insert the matching public.users row —
    // so the client never INSERTs into users (exactly one row per account, no
    // 409). Email confirmation is OFF, so signUp returns an active session and
    // onboarding can proceed immediately.
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    if (err) {
      setSubmitting(false);
      // Never render the provider's raw message — map by the stable error code
      // to our own copy (already-registered / weak password / malformed email),
      // with one calm fallback. `emailInUse` still drives the "log in" affordance.
      setEmailInUse(isEmailInUse(err));
      // Map the server error to the offending field so it lights up too:
      // weak_password → password; already-registered / bad-email → email.
      setErrorField(err.code === 'weak_password' ? 'password' : 'email');
      setError(authErrorMessage(err));
      return;
    }

    // Persist the display name into the row the on_auth_user_created trigger just
    // created. Email confirmation is OFF, so signUp returns an ACTIVE session;
    // upsert on id (while that session is live) sets first_name WITHOUT touching
    // pref_cuisine_id, so isOnboarded() stays false and onboarding proceeds.
    // Stored as entered/trimmed — no lowercasing (that rule is ingredients only).
    // Best-effort: a name-write hiccup must not strand an already-created account.
    const newUserId = data.user?.id;
    if (newUserId) {
      await supabase
        .from('users')
        .upsert(
          { id: newUserId, first_name: firstName.trim(), last_name: lastName.trim() },
          { onConflict: 'id' },
        );
    }

    // New account is not onboarded yet — clear the flag so the splash/onboarding
    // gate takes them through taste → avoid → constraints. The _layout
    // onAuthStateChange (SIGNED_IN) clears the id memo; getCurrentUserId then
    // resolves this new session on demand in constraints.
    await setLocalOnboarded(false);
    router.replace('/onboarding/taste');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
        <View style={styles.header}>
          <Text variant="title">Create your account</Text>
          <Text variant="body" color="textSecondary">
            You can start right away.
          </Text>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            First name
          </Text>
          <TextInput
            value={firstName}
            onChangeText={(t) => {
              setFirstName(t);
              if (errorField === 'first') setErrorField(null);
            }}
            placeholder="Your first name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            style={[styles.input, errorField === 'first' && styles.inputError]}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Last name
          </Text>
          <TextInput
            value={lastName}
            onChangeText={(t) => {
              setLastName(t);
              if (errorField === 'last') setErrorField(null);
            }}
            placeholder="Your last name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            style={[styles.input, errorField === 'last' && styles.inputError]}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (errorField === 'email') setErrorField(null);
            }}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, errorField === 'email' && styles.inputError]}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Password
          </Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errorField === 'password') setErrorField(null);
              }}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, styles.inputWithIcon, errorField === 'password' && styles.inputError]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
              style={styles.eye}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Confirm password
          </Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (errorField === 'confirm') setErrorField(null);
              }}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              style={[styles.input, styles.inputWithIcon, errorField === 'confirm' && styles.inputError]}
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
          <View style={styles.errorBlock}>
            <Text variant="body" color="error">
              {error}
            </Text>
            {emailInUse ? (
              <Pressable
                onPress={() => router.replace('/auth/login')}
                accessibilityRole="button"
                style={styles.link}
              >
                <Text variant="body" color="accent">
                  Log in instead
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Social sign-in — visual only, not wired */}
        <View style={styles.orRow}>
          <View style={styles.hairline} />
          <Text variant="body" color="textSecondary">or</Text>
          <View style={styles.hairline} />
        </View>
        <View style={styles.socialRow}>
          <Pressable onPress={() => setComingSoon(true)} accessibilityRole="button" accessibilityLabel="Continue with Google" style={styles.socialIcon}>
            <Ionicons name="logo-google" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setComingSoon(true)} accessibilityRole="button" accessibilityLabel="Continue with Apple" style={styles.socialIcon}>
            <Ionicons name="logo-apple" size={22} color={colors.text} style={{ marginTop: -2 }} />
          </Pressable>
        </View>
        {comingSoon ? (
          <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md, lineHeight: 28, paddingBottom: 2 }}>Coming soon</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'One moment…' : 'Create account'}
          onPress={handleSave}
          disabled={submitting}
        />
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
    // Clear the pinned footer button (a sibling View below the ScrollView, ~84px
    // tall): enough bottom room that the last line ("Coming soon") scrolls fully
    // clear of it rather than hiding beneath it.
    paddingBottom: spacing.xl * 2,
    // 2px of horizontal room so the browser focus ring (drawn outside the input
    // box) isn't clipped by the scroll container's overflow.
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
  // Invalid-field treatment: clay border + pale clay fill (never Sage).
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  passwordWrap: {
    justifyContent: 'center',
  },
  inputWithIcon: {
    // Leave room for the eye toggle at the right edge.
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
  errorBlock: {
    gap: spacing.xs,
  },
  // "or" divider between the email form and the secondary social row.
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors.chipBorder,
  },
  // Secondary social sign-in — a centered row of small circular icon buttons.
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
