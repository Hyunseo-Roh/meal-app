import { Redirect } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';

import { getAuthUser, withTimeout } from '../lib/currentUser';
import { Screen } from './Screen';
import { Text } from './Text';

/**
 * Session gate for standalone (non-tab) routes reachable by deep link —
 * /subscription, /scanner, /history, /meal/[id]. Without it a logged-out visitor
 * saw those pages render in full (/subscription, /scanner) or hit a generic data
 * error (/history, /meal) instead of being sent to Welcome like the tab routes.
 *
 * Returns null when a real session is present (render the screen); otherwise
 * returns the element to render INSTEAD: a brief loading line while the session
 * is being read, or a <Redirect> to /welcome when there's no session (or the
 * read fails — never expose the screen on an unknown state). Mirrors the (tabs)
 * guard but redirects straight to /welcome.
 *
 * Usage: call it FIRST among the screen's hooks, then `if (gate) return gate;`
 * BEFORE any of the screen's own permission / loading / error / content
 * branches, so the redirect wins over a data-error state.
 */
export function useSessionGate(): ReactElement | null {
  const [state, setState] = useState<'checking' | 'ok' | 'redirect'>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await withTimeout(getAuthUser());
        if (active) setState(user ? 'ok' : 'redirect');
      } catch {
        // Unknown session state — don't expose the screen; send to Welcome.
        if (active) setState('redirect');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state === 'ok') return null;
  if (state === 'redirect') return <Redirect href="/welcome" />;
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Text variant="body" color="textSecondary">
        One moment…
      </Text>
    </Screen>
  );
}
