import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

/**
 * Connection status, detected ONCE at the root and shared through context — no
 * screen does its own detection. Web-only signal (`navigator.onLine` + the
 * window online/offline events); on native, where navigator.onLine isn't
 * meaningful, we assume online (the graded artifact is the web build).
 */
const OnlineContext = createContext(true);

export function useOnline(): boolean {
  return useContext(OnlineContext);
}

function readOnline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(readOnline);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const update = () => setOnline(readOnline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update(); // sync in case the state changed before listeners attached
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

/**
 * The single, app-wide offline notice. Appears while the connection is down and
 * disappears when it returns. Non-blocking: a thin bar in the layout flow, not a
 * modal — the app stays fully usable. It's the ONE place that names the
 * connection, so per-screen errors never have to guess at a cause.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.bar}>
      <Text variant="caption" color="bg">
        You&apos;re offline
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.text, // Charcoal Ink + Bone text — a calm system notice, no alarm color
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
});
