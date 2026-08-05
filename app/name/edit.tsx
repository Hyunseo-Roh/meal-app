import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/states';
import { Text } from '../../components/Text';
import { loadFirstName, saveFirstName } from '../../lib/profile';
import { colors, spacing, typography } from '../../theme/tokens';

// Reasonable cap so a stray paste can't blow out the greeting / DB column.
const MAX_NAME = 40;
type Status = 'loading' | 'ready' | 'error';

/**
 * Name editor — same shape as the taste editor (app/taste/edit.tsx): back arrow,
 * a single input, a Save footer. Reads/writes users.first_name (the column Home's
 * "Hi {firstName}" greeting reads), so saving here updates the greeting. Only the
 * first name is edited; last_name is left untouched.
 */
export default function EditName() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setName(await loadFirstName());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_NAME;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveFirstName(trimmed);
      router.back();
    } catch {
      setSaving(false);
      setError('Your name didn’t save');
    }
  }

  if (status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="Getting your name…" delayMs={250} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.centered}>
        <ErrorState title="Couldn't open this" message="Your name didn't load" onRetry={load} />
      </Screen>
    );
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
        <Text variant="title">Your name</Text>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            First name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={save}
            placeholder="Your first name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoFocus
            maxLength={MAX_NAME}
            returnKeyType="done"
            style={styles.input}
          />
          <Text variant="body" color="textSecondary">
            This is the name on your home greeting.
          </Text>
        </View>

        {error ? (
          <Text variant="body" color="error">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save'}
          onPress={save}
          disabled={saving || !valid}
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
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
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
  centered: {
    justifyContent: 'center',
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
