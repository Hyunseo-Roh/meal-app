import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { authErrorMessage } from '../../lib/authErrors';
import { isOnboarded, resetCurrentUser, setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which field(s) to mark invalid (clay border + fill). invalid_credentials is
  // ambiguous (email OR password), so it lights both.
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [invalidPassword, setInvalidPassword] = useState(false);
  // Password visibility toggle (display only — no auth logic).
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setError(null);
    setInvalidEmail(false);
    setInvalidPassword(false);
    if (!email.trim()) {
      setInvalidEmail(true);
      setError('Enter your email');
      return;
    }
    if (!password) {
      setInvalidPassword(true);
      setError('Enter your password');
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setSubmitting(false);
      // Never render the provider's raw message — map to our own copy. Wrong
      // password and unknown email both arrive as invalid_credentials, so they
      // read the same; everything else falls to one calm line. Light both fields.
      setInvalidEmail(true);
      setInvalidPassword(true);
      setError(authErrorMessage(err));
      return;
    }
    // Identity just changed. Reset the memo NOW (don't wait for the async
    // onAuthStateChange) so isOnboarded() resolves against the NEW account, then
    // set the device flag to the DB truth and route accordingly. An already-
    // onboarded account must NEVER be pushed back through onboarding.
    resetCurrentUser();
    try {
      const done = await isOnboarded();
      await setLocalOnboarded(done);
      router.replace(done ? '/(tabs)/home' : '/onboarding/taste');
    } catch {
      // Couldn't confirm onboarded state — let the splash resolve it (for a
      // logged-in account the splash defaults to Home, never a forced re-onboard).
      router.replace('/');
    }
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
          <Text variant="title">Log in</Text>
          <Text variant="body" color="textSecondary">
            Welcome back
          </Text>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (invalidEmail) setInvalidEmail(false);
            }}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={[styles.input, invalidEmail && styles.inputError]}
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
                if (invalidPassword) setInvalidPassword(false);
              }}
              placeholder="Your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!submitting}
              style={[styles.input, styles.inputWithIcon, invalidPassword && styles.inputError]}
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

        <Pressable
          onPress={() => router.push('/auth/forgot-password')}
          accessibilityRole="button"
          style={styles.forgot}
        >
          <Text variant="body" color="accent">
            Forgot password?
          </Text>
        </Pressable>

        {error ? (
          <Text variant="body" color="error">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => router.replace('/auth/register')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text variant="body" color="accent">
            New here? Sign up
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'One moment…' : 'Log in'}
          onPress={handleLogin}
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
    // 2px of horizontal room so the browser focus ring (drawn outside the input
    // box) isn't clipped by the scroll container's overflow. Offsets the inputs
    // by 2px each side — visually unnoticeable, keeps the 24px screen margin feel.
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
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  // Invalid-field treatment: clay border + pale clay fill. Fires on submit /
  // field error, clears on edit. Never Sage (success-only).
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  forgot: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -spacing.sm,
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
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
});
