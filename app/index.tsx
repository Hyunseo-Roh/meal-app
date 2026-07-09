import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import {
  getAuthUser,
  isOnboarded,
  resetCurrentUser,
  userRowExists,
  withTimeout,
} from '../lib/currentUser';
import { supabase } from '../lib/supabase';
import { StyleSheet } from 'react-native';

/**
 * Entry splash / router. The single decision point that used to live inside
 * the Home tab. It READS the session (never creates one) and resolves to a
 * stable terminal: Welcome, Home, or Onboarding.
 *
 * Stability (no ping-pong with the (tabs) guard): we never redirect while the
 * decision is still `null` — the "One moment…" line renders until session +
 * onboarded state are fully known. Only then do we emit exactly one <Redirect>
 * to a terminal. The (tabs) guard only bounces to '/', and '/' only sends an
 * onboarded/authed user INTO the tabs, so a satisfied user never re-triggers
 * the guard.
 */
type Dest = '/welcome' | '/(tabs)/home' | '/onboarding/taste';

export default function Index() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await decide();
      if (active) setDest(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!dest) {
    return (
      <Screen style={styles.centered}>
        <Text variant="body" color="textSecondary">
          One moment…
        </Text>
      </Screen>
    );
  }

  return <Redirect href={dest} />;
}

/**
 * Resolve the destination from session + onboarded state. Fail-safe: any error
 * with a session present prefers the least-disruptive sensible terminal;
 * with no session, Welcome.
 */
async function decide(): Promise<Dest> {
  // Reads the persisted session only — does NOT mint an anonymous identity.
  let user: Awaited<ReturnType<typeof getAuthUser>>;
  try {
    user = await withTimeout(getAuthUser());
  } catch {
    // Session state unknown — safest is Welcome (never auto-creates identity).
    return '/welcome';
  }

  if (!user) return '/welcome';

  // Legacy anonymous session (left over from before the required-sign-up gate):
  // sign it out and force sign-up. Anon-only data is orphaned by design.
  if (user.isAnonymous) {
    try {
      await withTimeout(supabase.auth.signOut());
    } catch {
      // best-effort; still route to Welcome
    }
    resetCurrentUser();
    return '/welcome';
  }

  // Real account. Guard the deleted-account edge FIRST: a lingering session
  // whose public.users row was removed (delete_user_data) must go to Welcome —
  // NOT onboarding, which would loop (constraints.tsx UPDATEs a missing row).
  // A normal user always has a row, so this branch never fires for them.
  try {
    if (!(await withTimeout(userRowExists()))) {
      try {
        await withTimeout(supabase.auth.signOut());
      } catch {
        // best-effort; still route to Welcome
      }
      resetCurrentUser();
      return '/welcome';
    }
    // Row exists → the DB is the source of truth for onboarded status.
    const done = await withTimeout(isOnboarded());
    return done ? '/(tabs)/home' : '/onboarding/taste';
  } catch {
    // Transient error — keep a signed-in user out of a re-onboarding loop.
    return '/(tabs)/home';
  }
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
});
