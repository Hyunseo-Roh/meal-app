import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { changePasswordErrorMessage } from '../lib/authErrors';
import { getAuthUser } from '../lib/currentUser';
import { markPasswordChanged } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../theme/tokens';

// Matches the signup minimum (auth/register.tsx) — not a new rule.
const MIN_PASSWORD = 6;

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-field visibility (display only — no auth logic), same as auth screens.
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSave() {
    setError(null);
    // Client pre-checks, in order. Length matches signup; server password errors
    // are still mapped below and never overwritten by a pre-check.
    if (!current) {
      setError('Enter your current password');
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setError('Your password needs at least 6 characters');
      return;
    }
    if (next !== confirm) {
      setError('Passwords don’t match');
      return;
    }
    if (next === current) {
      setError('Your new password needs to be different');
      return;
    }

    setSubmitting(true);
    // Reauthenticate first. Supabase can updateUser({ password }) on the session
    // WITHOUT the old password, but requiring it guards an unattended session.
    // signInWithPassword against the SAME account refreshes the session (never
    // signs the user out); a failure here is specifically a wrong current pw.
    const auth = await getAuthUser();
    const email = auth?.email;
    if (!email) {
      setSubmitting(false);
      setError('That didn’t go through');
      return;
    }

    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthErr) {
      setSubmitting(false);
      setError(changePasswordErrorMessage(reauthErr));
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    if (updateErr) {
      setSubmitting(false);
      setError(changePasswordErrorMessage(updateErr));
      return;
    }

    // Success — stay signed in, hand a one-shot confirmation to Profile and return.
    markPasswordChanged();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
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
          <Text variant="title">Change password</Text>
          <Text variant="body" color="textSecondary">
            Enter your current password, then a new one
          </Text>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Current password
          </Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="Your current password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              editable={!submitting}
              style={[styles.input, styles.inputWithIcon]}
            />
            <Pressable
              onPress={() => setShowCurrent((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showCurrent ? 'Hide password' : 'Show password'}
              hitSlop={8}
              style={styles.eye}
            >
              <Ionicons
                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            New password
          </Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showNext}
              autoCapitalize="none"
              editable={!submitting}
              style={[styles.input, styles.inputWithIcon]}
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
              onChangeText={setConfirm}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              editable={!submitting}
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

        {error ? <Text variant="body">{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'One moment…' : 'Update password'}
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
