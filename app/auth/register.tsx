import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInUse, setEmailInUse] = useState(false);
  // Non-functional social sign-in: tapping shows a calm "coming soon" note,
  // same pattern as the Pantry premium cards. No OAuth is wired.
  const [comingSoon, setComingSoon] = useState(false);
  // Per-field password visibility (display only — no auth logic).
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSave() {
    setError(null);
    setEmailInUse(false);
    // Fast client-side pre-checks. The <6 check is only a pre-check; server
    // password errors are surfaced verbatim below (never overwritten).
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    // Create a real account. signUp inserts one row into auth.users, which fires
    // the on_auth_user_created trigger to insert the matching public.users row —
    // so the client never INSERTs into users (exactly one row per account, no
    // 409). Email confirmation is OFF, so signUp returns an active session and
    // onboarding can proceed immediately.
    const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    if (err) {
      setSubmitting(false);
      const msg = err.message ?? '';
      if (/already|registered|exists/i.test(msg)) {
        setEmailInUse(true);
        setError('That email is already registered');
      } else {
        // Surface the server's actual reason (incl. password rules); generic only
        // if the server gave no message.
        setError(msg || 'Couldn’t create your account. Try again.');
      }
      return;
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
            We&apos;ll send a link to confirm your email — you can start right away.
          </Text>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Password
          </Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, styles.inputWithIcon]}
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
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              style={[styles.input, styles.inputWithIcon]}
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
            <Text variant="body">{error}</Text>
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

        {/* Social sign-in — visual only, not wired. Tap shows a calm note. */}
        <View style={styles.social}>
          <Pressable
            onPress={() => setComingSoon(true)}
            accessibilityRole="button"
            style={styles.ghost}
          >
            <Text variant="body">Continue with Google</Text>
          </Pressable>
          <Pressable
            onPress={() => setComingSoon(true)}
            accessibilityRole="button"
            style={styles.ghost}
          >
            <Text variant="body">Continue with Apple</Text>
          </Pressable>
          {comingSoon ? (
            <Text variant="body" color="textSecondary">
              Coming soon
            </Text>
          ) : null}
        </View>
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
    paddingBottom: spacing.xl,
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
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
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
  social: {
    gap: spacing.md,
  },
  ghost: {
    height: 52,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
