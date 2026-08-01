import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getCurrentUserId } from '../lib/currentUser';
import { loadFeedback, saveFeedback, type Rating } from '../lib/feedback';
import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

// Thumbs control — same feedback values as before (loved_it / not_for_me), just
// an icon control instead of the two text pills. Labels stay descriptive for a11y.
const OPTIONS: { rating: Rating; label: string; icon: 'thumbs-up' | 'thumbs-down' }[] = [
  { rating: 'loved_it', label: 'Loved it', icon: 'thumbs-up' },
  { rating: 'not_for_me', label: 'Not for me', icon: 'thumbs-down' },
];

/**
 * Two-state taste feedback for one recommendation option. Tapping a choice
 * saves it; tapping the selected choice again clears it. Keyed per option
 * (see lib/feedback.ts). Errors are surfaced, never swallowed.
 */
export function FeedbackControl({ optionId }: { optionId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const uid = await getCurrentUserId();
        const current = await loadFeedback(uid, optionId);
        if (!active) return;
        setUserId(uid);
        setRating(current);
        setStatus('ready');
      } catch {
        if (!active) return;
        // Fail open: let the user still record feedback even if the initial
        // read hiccuped. A save will reconcile the row.
        setStatus('ready');
        setError("Couldn't load your last take.");
      }
    })();
    return () => {
      active = false;
    };
  }, [optionId]);

  const choose = useCallback(
    async (next: Rating) => {
      if (saving) return;
      let uid = userId;
      if (!uid) {
        try {
          uid = await getCurrentUserId();
          setUserId(uid);
        } catch {
          setError("Couldn't save that. Try again.");
          return;
        }
      }
      const target: Rating | null = rating === next ? null : next;
      const prev = rating;
      setRating(target); // optimistic
      setError(null);
      setSaving(true);
      try {
        await saveFeedback(uid, optionId, target);
      } catch {
        setRating(prev); // roll back
        setError("Couldn't save that. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, userId, rating, optionId],
  );

  if (status === 'loading') return null;

  return (
    <View style={styles.section}>
      <Text variant="caption" color="textSecondary">
        Your take
      </Text>
      <View style={styles.row}>
        {OPTIONS.map(({ rating: r, label, icon }) => {
          const selected = rating === r;
          return (
            <Pressable
              key={r}
              onPress={() => choose(r)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: saving }}
              accessibilityLabel={label}
              style={[styles.pill, selected ? styles.pillSelected : styles.pillIdle]}
            >
              <Ionicons
                name={selected ? icon : `${icon}-outline`}
                size={22}
                color={selected ? colors.bg : colors.text}
              />
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="body" color="textSecondary">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pill: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  pillIdle: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
  },
  pillSelected: {
    // Charcoal fill + Bone text (see the Text color prop) — matches Chip's
    // selected state for AA contrast; the muted Cool Slate read as disabled.
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.text,
  },
});
