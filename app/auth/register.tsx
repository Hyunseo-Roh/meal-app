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

  async function handleSave() {
    setError(null);
    setEmailInUse(false);
    // Fast client-side pre-checks. The <6 check is only a pre-check; server
    // password errors are surfaced verbatim below (never overwritten).
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    // Promote the CURRENT anonymous user in place — same user.id, so all their
    // prefs / pantry / feedback stay attached. NOT a new account (that would be
    // signUp). Email confirmation is off, so this is usable immediately.
    const { error: err } = await supabase.auth.updateUser({ email: email.trim(), password });
    if (err) {
      setSubmitting(false);
      const msg = err.message ?? '';
      if (/already|registered|exists/i.test(msg)) {
        setEmailInUse(true);
        setError('That email is already registered.');
      } else {
        // Surface the server's actual reason (incl. password rules); generic only
        // if the server gave no message.
        setError(msg || 'Couldn’t save your account. Try again.');
      }
      return;
    }
    // Promotion keeps the same id, so this user is already onboarded — assert the
    // local flag so the Home gate never bounces them into onboarding. No race:
    // the _layout onAuthStateChange → resetCurrentUser only clears the id memo,
    // not this flag.
    await setLocalOnboarded(true);
    router.replace('/');
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
          <Text variant="title">Save your account.</Text>
          <Text variant="body" color="textSecondary">
            Keep your taste and pantry across devices.
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
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" color="textSecondary">
            Confirm password
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
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
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'One moment…' : 'Save account'}
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
  errorBlock: {
    gap: spacing.xs,
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
