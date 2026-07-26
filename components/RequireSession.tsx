import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { getAuthUser, withTimeout } from '../lib/currentUser';
import { Screen } from './Screen';
import { ErrorState } from './states';
import { Text } from './Text';

/**
 * Session gate for standalone (non-tab) routes reachable by deep link —
 * /subscription, /scanner, /history, /meal/[id]. Without it a logged-out visitor
 * saw those pages render in full (/subscription, /scanner) or hit a generic data
 * error (/history, /meal) instead of being sent to Welcome like the tab routes.
 *
 * Returns null when a real session is present (render the screen); otherwise
 * returns the element to render INSTEAD:
 *   - a brief loading line while the session is being read;
 *   - a <Redirect> to /welcome ONLY on a DEFINITE no-session;
 *   - a retryable error when the read FAILS/times out (indeterminate) — a failed
 *     read must NOT imply logged out (would falsely bounce a signed-in user to
 *     Welcome). getAuthUser() can throw via withTimeout, so this path is real.
 *
 * Usage: call it FIRST among the screen's hooks, then `if (gate) return gate;`
 * BEFORE any of the screen's own permission / loading / error / content
 * branches, so the gate wins over a data-error state.
 */
export function useSessionGate(): ReactElement | null {
  const [state, setState] = useState<'checking' | 'ok' | 'redirect' | 'error'>('checking');

  const run = useCallback(() => {
    let active = true;
    setState('checking');
    (async () => {
      try {
        const user = await withTimeout(getAuthUser());
        // Definite result only: present -> render; null -> Welcome.
        if (active) setState(user ? 'ok' : 'redirect');
      } catch {
        // Indeterminate read (timeout / failure): retryable error, NOT a Welcome
        // redirect — never imply logged out on an unknown state.
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => run(), [run]);

  if (state === 'ok') return null;
  if (state === 'redirect') return <Redirect href="/welcome" />;
  if (state === 'error') {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ErrorState title="Couldn't get you in" message="Your session didn't load" onRetry={run} />
      </Screen>
    );
  }
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Text variant="body" color="textSecondary">
        One moment…
      </Text>
    </Screen>
  );
}
