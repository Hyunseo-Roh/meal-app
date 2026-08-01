import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';
import { Text } from './Text';
import { useDelayedFlag } from './useDelayedFlag';

/**
 * Shared four-state primitives (loading / empty / error). Structure and the
 * single retry treatment only — every string is passed in by the caller, so
 * these introduce no copy of their own. Callers place them either inside a
 * centered <Screen> (full-screen states) or inline (list zones).
 *
 * Retry treatment: a Charcoal PrimaryButton. Retry is the primary recovery
 * action on an error screen, so it gets the app's primary-action weight and tap
 * target rather than a low-emphasis text link. The button renders only when an
 * onRetry is provided, so a screen with no retry path (e.g. the taste-editor
 * load error) reuses the same component with just a heading + line.
 */

/**
 * `delayMs` suppresses brief loader flashes: LoadingState is mounted only while
 * loading, so if the fetch resolves before `delayMs` the component unmounts and
 * nothing is ever shown; a load still running past the delay shows the message.
 * Default 0 → renders immediately (unchanged for callers that don't opt in).
 */
export function LoadingState({ message, delayMs = 0 }: { message: string; delayMs?: number }) {
  const show = useDelayedFlag(true, delayMs);
  if (!show) return null;
  return (
    <Text variant="body" color="textSecondary">
      {message}
    </Text>
  );
}

export function EmptyState({ message, centered }: { message: string; centered?: boolean }) {
  return (
    <Text variant="body" color="textSecondary" style={centered ? styles.centeredText : undefined}>
      {message}
    </Text>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.errorBlock}>
      {title ? <Text variant="title">{title}</Text> : null}
      <Text variant="body" color="textSecondary">
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.retry}>
          <PrimaryButton label={retryLabel} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centeredText: {
    textAlign: 'center',
  },
  errorBlock: {
    gap: spacing.md,
  },
  retry: {
    marginTop: spacing.xs,
  },
});
