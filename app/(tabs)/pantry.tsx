import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { addPantryItem, deletePantryItem, listPantry, type PantryItem } from '../../lib/pantry';
import { colors, spacing, typography } from '../../theme/tokens';

// Local staple list (decoupled — not imported from the onboarding pantry screen).
const QUICK_ADD = ['rice', 'pasta', 'eggs', 'olive oil', 'garlic', 'onion', 'shrimp', 'chicken'];

// Front-end pantry grouping — DISPLAY ONLY. The category is derived from the
// item name (first keyword match wins); nothing is stored (no category column).
// Unmatched items fall into "Other".
const CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: 'Proteins', keywords: ['chicken', 'beef', 'pork', 'shrimp', 'prawn', 'fish', 'salmon', 'tuna', 'egg', 'tofu', 'bean', 'lentil', 'turkey', 'bacon', 'sausage', 'ham', 'meat'] },
  { label: 'Vegetables', keywords: ['onion', 'garlic', 'tomato', 'carrot', 'broccoli', 'spinach', 'lettuce', 'potato', 'mushroom', 'cucumber', 'celery', 'zucchini', 'cabbage', 'kale', 'corn', 'pea', 'pepper', 'bell'] },
  { label: 'Fruit', keywords: ['apple', 'banana', 'lemon', 'lime', 'orange', 'berry', 'grape', 'mango', 'avocado', 'peach', 'pear'] },
  { label: 'Dairy', keywords: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'parmesan'] },
  { label: 'Grains', keywords: ['rice', 'pasta', 'noodle', 'bread', 'flour', 'oat', 'quinoa', 'tortilla', 'cereal', 'couscous', 'barley', 'bagel', 'cracker'] },
  { label: 'Seasonings', keywords: ['salt', 'oil', 'sauce', 'soy', 'vinegar', 'spice', 'cumin', 'paprika', 'oregano', 'basil', 'ginger', 'honey', 'sugar', 'sesame', 'chili', 'curry', 'stock', 'broth'] },
];
const CATEGORY_ORDER = [...CATEGORIES.map((c) => c.label), 'Other'];

function categorize(name: string): string {
  const n = name.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keywords.some((k) => n.includes(k))) return c.label;
  }
  return 'Other';
}

// Non-functional premium placeholders. No entitlement check — pure UI.
const PREMIUM = [
  { key: 'scan', title: 'Barcode scan', subtitle: 'Scan packages to add them instantly.' },
  { key: 'ai', title: 'AI Chef', subtitle: 'Turn what you have into new ideas.' },
] as const;

type Status = 'loading' | 'ready' | 'error';

export default function Pantry() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [tappedPremium, setTappedPremium] = useState<string | null>(null);

  // Manual retry (from the error state): show the loading line while refetching.
  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setItems(await listPantry());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Silent refresh on focus — keep showing current items, never flash "Loading…".
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const rows = await listPantry();
          if (active) {
            setItems(rows);
            setStatus('ready');
          }
        } catch {
          if (active) setStatus('error');
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const has = (name: string) => items.some((i) => i.name === name.trim().toLowerCase());

  async function add(name: string) {
    const v = name.trim().toLowerCase();
    if (!v || adding || has(v)) return;
    setAdding(true);
    setError(null);
    try {
      const row = await addPantryItem(v);
      if (row) setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
    } catch {
      setError('Couldn’t add that. Try again.');
    } finally {
      setAdding(false);
    }
  }

  async function addDraft() {
    const v = draft;
    setDraft('');
    await add(v);
  }

  async function remove(item: PantryItem) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id)); // optimistic
    setError(null);
    try {
      await deletePantryItem(item.id);
    } catch {
      setItems(prev); // rollback
      setError('Couldn’t remove that. Try again.');
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="title">Pantry</Text>
          <Text variant="body" color="textSecondary">
            What&apos;s in your kitchen — Sate tracks the gaps.
          </Text>
        </View>

        {/* Add by name */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Add an item
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            placeholder="Type an item, press enter"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            returnKeyType="done"
            style={styles.input}
          />
          <PrimaryButton label={adding ? 'Adding…' : 'Add'} onPress={addDraft} disabled={adding} />
        </View>

        {/* Quick add — ADD-ONLY. Already-added staples render dimmed + non-interactive. */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Quick add
          </Text>
          <View style={styles.chipRow}>
            {QUICK_ADD.map((name) =>
              has(name) ? (
                <View key={name} style={styles.dim} pointerEvents="none">
                  <Chip label={name} selected={false} onPress={() => {}} />
                </View>
              ) : (
                <Chip key={name} label={name} selected={false} onPress={() => add(name)} />
              ),
            )}
          </View>
        </View>

        {/* Current pantry — removal is the ONLY delete path (tap the × chip). */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            In your pantry
          </Text>
          {status === 'loading' ? (
            <Text variant="body" color="textSecondary">
              Loading…
            </Text>
          ) : status === 'error' ? (
            <View style={styles.errorRow}>
              <Text variant="body" color="textSecondary">
                Couldn&apos;t load your pantry.
              </Text>
              <Pressable onPress={load} accessibilityRole="button" style={styles.link}>
                <Text variant="body" color="accent">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <Text variant="body" color="textSecondary">
              Nothing here yet — add a staple above.
            </Text>
          ) : (
            <View style={styles.groups}>
              {CATEGORY_ORDER.map((cat) => {
                const groupItems = items.filter((it) => categorize(it.name) === cat);
                if (groupItems.length === 0) return null;
                return (
                  <View key={cat} style={styles.group}>
                    <Text variant="caption" color="textSecondary">
                      {cat}
                    </Text>
                    <View style={styles.chipRow}>
                      {groupItems.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => remove(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                          style={styles.tag}
                        >
                          <Text variant="body" color="bg">
                            {item.name}
                          </Text>
                          <Text variant="body" color="bg">
                            ×
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {error ? <Text variant="body">{error}</Text> : null}

        {/* Premium placeholders — non-functional, no entitlement check. */}
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            More, with Premium
          </Text>
          {PREMIUM.map((card) => (
            <Pressable
              key={card.key}
              onPress={() => setTappedPremium(card.key)}
              accessibilityRole="button"
              style={styles.premiumCard}
            >
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} style={styles.lock} />
              <View style={styles.premiumBody}>
                <View style={styles.premiumTitleRow}>
                  <Text variant="body">{card.title}</Text>
                  <View style={styles.badge}>
                    <Text variant="caption" color="textSecondary">
                      Premium
                    </Text>
                  </View>
                </View>
                <Text variant="body" color="textSecondary">
                  {card.subtitle}
                </Text>
                {tappedPremium === card.key ? (
                  <Text variant="body" color="textSecondary">
                    Coming soon
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
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
  groups: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dim: {
    opacity: 0.4,
  },
  // Local replica of onboarding's RemovableTag (NOT imported — keeps the tab
  // decoupled from onboarding). Accent pill + × ; whole chip removes.
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorRow: {
    gap: spacing.sm,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  premiumCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  lock: {
    marginTop: spacing.xs,
  },
  premiumBody: {
    flex: 1,
    gap: spacing.xs,
  },
  premiumTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
