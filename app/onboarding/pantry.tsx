import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { getCurrentUserId, setLocalOnboarded } from '../../lib/currentUser';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography } from '../../theme/tokens';
import { useOnboarding } from './_layout';

// UI suggestion list only — not schema.
const QUICK_ADD = ['olive oil', 'garlic', 'eggs', 'tuna', 'lemon', 'spinach', 'onion', 'chicken'];

// Page 3 of 3 — Pantry (optional). Staged in the shared draft; written to
// pantry_items on Done. Prominent "Skip for now" keeps it low-pressure.
export default function PantrySetup() {
  const router = useRouter();
  const { pantry: items, setPantry: setItems } = useOnboarding();

  const [draft, setDraft] = useState('');
  const [scanNote, setScanNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    const v = name.trim().toLowerCase();
    if (!v) return;
    setItems((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function addDraft() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    setItems((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
    setDraft('');
  }

  async function finish() {
    setSaving(true);
    setError(null);

    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch {
      setSaving(false);
      setError("Couldn't save your pantry. Try once more.");
      return;
    }

    // Pantry may be empty (skippable) — just move on.
    if (items.size > 0) {
      // Dedupe against what the user already has so re-adding a staple is a
      // harmless no-op (there's no DB unique constraint on (user_id, name), so
      // a blind insert would create duplicate rows). Only insert new names.
      const { data: existing, error: readError } = await supabase
        .from('pantry_items')
        .select('name')
        .eq('user_id', userId);
      if (readError) {
        setSaving(false);
        setError("Couldn't save your pantry. Try once more.");
        return;
      }

      const have = new Set((existing ?? []).map((r) => (r.name as string).toLowerCase()));
      const now = new Date().toISOString();
      const rows = [...items]
        .filter((name) => !have.has(name))
        .map((name) => ({
          user_id: userId,
          name,
          source: 'manual' as const,
          created_at: now,
          updated_at: now,
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('pantry_items').insert(rows);
        if (insertError) {
          setSaving(false);
          setError("Couldn't save your pantry. Try once more.");
          return;
        }
      }
    }

    // End of onboarding — persist the local flag (covers the Skip path too) so
    // Screen 3's gate is instant on every future entry.
    await setLocalOnboarded(true);

    router.replace('/');
  }

  const added = [...items];

  return (
    <Screen>
      <Pressable
        onPress={() => router.replace('/onboarding/constraints')}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 3 of 3 */}
        <View style={styles.progress}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
        </View>
        <Text variant="caption" color="textSecondary">
          Step 3 of 3
        </Text>

        <View style={styles.header}>
          <Text variant="title">What&apos;s usually in your kitchen?</Text>
          <Text variant="body" color="textSecondary">
            Optional — add a few staples, or skip and do it later.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Scan a barcode
          </Text>
          <Pressable
            onPress={() => setScanNote(true)}
            accessibilityRole="button"
            style={styles.ghost}
          >
            <Text variant="body" color="accent">
              Scan a barcode
            </Text>
          </Pressable>
          {scanNote ? (
            <Text variant="body" color="textSecondary">
              Scanning comes soon — add items by name for now.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Add your own
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            placeholder="Type an item, press enter"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Quick add
          </Text>
          <View style={styles.chipRow}>
            {QUICK_ADD.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={items.has(name)}
                onPress={() => toggle(name)}
              />
            ))}
          </View>
        </View>

        {added.length > 0 ? (
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Added to your pantry
            </Text>
            <View style={styles.chipRow}>
              {added.map((name) => (
                <Chip key={name} label={name} selected onPress={() => toggle(name)} />
              ))}
            </View>
          </View>
        ) : null}

        {error ? (
          <Text variant="body" color="text">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={saving ? 'Saving…' : 'Done.'} onPress={finish} disabled={saving} />
        <View style={styles.skip}>
          <Text variant="caption" color="accent" onPress={saving ? undefined : finish}>
            Skip for now
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  progressActive: {
    backgroundColor: colors.accent,
  },
  header: {
    gap: spacing.sm,
  },
  section: {
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  skip: {
    alignItems: 'center',
  },
});
