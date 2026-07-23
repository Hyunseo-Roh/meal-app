import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/states';
import {
  getAuthUser,
  isOnboarded,
  resetCurrentUser,
  userRowExists,
  withTimeout,
} from '../lib/currentUser';
import { supabase } from '../lib/supabase';

/**
 * Entry splash / router. The single decision point that used to live inside
 * the Home tab. It READS the session (never creates one) and resolves to a
 * stable terminal: Welcome, Home, or Onboarding.
 *
 * Stability (no ping-pong with the (tabs) guard): we never redirect while the
 * decision is still `null` — the loading line renders until session + onboarded
 * state are fully known. Only then do we emit exactly one <Redirect> to a
 * terminal. Critically, a HARD read failure resolves to a terminal ErrorState
 * with retry (NOT '/(tabs)/home') — routing an authenticated-but-unvalidated
 * user into the guarded tabs made the guard bounce back to '/', which re-ran
 * this decision and looped, re-issuing isOnboarded()/userRowExists() each lap.
 * Landing on the error state instead names the real situation and has nothing
 * for the guard to bounce.
 */
type Dest = '/welcome' | '/(tabs)/home' | '/onboarding/taste';

export default function Index() {
  const [dest, setDest] = useState<Dest | 'error' | null>(null);

  const run = useCallback(() => {
    let active = true;
    setDest(null);
    (async () => {
      const next = await decide();
      if (active) setDest(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => run(), [run]);

  if (dest === null) {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="Getting you in…" />
      </Screen>
    );
  }

  if (dest === 'error') {
    return (
      <Screen style={styles.centered}>
        <ErrorState
          title="Couldn't get you in"
          message="Your account didn't load"
          onRetry={run}
        />
      </Screen>
    );
  }

  return <Redirect href={dest} />;
}

/**
 * Resolve the destination from session + onboarded state. With no session,
 * Welcome. A hard read failure for an authenticated user resolves to 'error'
 * (a terminal retry state) rather than routing into the guarded tabs.
 */
async function decide(): Promise<Dest | 'error'> {
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
    // Hard read failure for an authenticated user. Do NOT route into the guarded
    // tabs (the guard would bounce back here and loop, re-issuing these reads).
    // Surface a terminal error with retry instead.
    return 'error';
  }
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
});
