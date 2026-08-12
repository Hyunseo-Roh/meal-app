import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { resetRequestErrorMessage } from '../../lib/authErrors';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';

/**
 * Forgot-password — STEP 1 of the recovery flow: request a reset link.
 *
 * Calls supabase.auth.resetPasswordForEmail with a redirectTo pointing at our
 * own /auth/reset-password route (web only — on native there's no URL to land
 * on, so we omit it and GoTrue uses the project default). On success we replace
 * the form with a plain "check your email" confirmation in the locked voice —
 * no hype. GoTrue returns success even for unknown emails (no enumeration), so
 * the confirmation is identical regardless.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setError(null);
    setInvalidEmail(false);
    if (!email.trim()) {
      setInvalidEmail(true);
      setError('Enter your email');
      return;
    }

    setSubmitting(true);
    // On web the reset link must land back in THIS app; use the current origin
    // so it works on localhost and the deployed URL alike. On native there is no
    // origin — omit redirectTo and let GoTrue use the project's Site URL.
    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : undefined;

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setSubmitting(false);
    if (err) {
      setInvalidEmail(err.code === 'validation_failed');
      setError(resetRequestErrorMessage(err));
      return;
    }
    setSent(true);
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
        {sent ? (
          <View style={styles.header}>
            <Text variant="title">Check your email</Text>
            <Text variant="body" color="textSecondary">
              If that address has an account, a reset link is on its way. Open it to set a new
              password.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text variant="title">Reset password</Text>
              <Text variant="body" color="textSecondary">
                Enter your account email and a reset link will follow.
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

            {error ? (
              <Text variant="body" color="error">
                {error}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {sent ? (
          <PrimaryButton label="Back to log in" onPress={() => router.replace('/auth/login')} />
        ) : (
          <PrimaryButton
            label={submitting ? 'One moment…' : 'Send reset link'}
            onPress={handleSend}
            disabled={submitting}
          />
        )}
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
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
