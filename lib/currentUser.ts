import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

/**
 * Real-account identity. The app requires sign-up before onboarding (no
 * anonymous entry): `supabase.auth.signUp` creates the auth user and the DB
 * trigger (`on_auth_user_created`) inserts the matching `public.users` row —
 * so this module never writes to the users table. Supabase's own auth storage
 * (see lib/supabase.ts) persists the session across reloads.
 *
 * `getCurrentUserId()` reads the existing session and NEVER creates one; with
 * no session it rejects, and callers behind the sign-up gate surface a calm
 * error. This module never runs at import time — it is only awaited from client
 * effects / event handlers, so it is web-SSR safe.
 */

const ONBOARDED_KEY = 'app_onboarded';

// In-memory memo so concurrent callers in one session share a single create.
let cachedId: string | null = null;
let inflight: Promise<string> | null = null;

/**
 * Race a promise against a timeout so a stalled mobile request can never hang
 * the UI. On timeout the returned promise rejects with `timeout`, letting
 * callers fail open / show a calm retry instead of sitting forever.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    // Normalize: supabase query builders are PromiseLike (thenables), not Promises.
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Local "has onboarded" flag — read instantly from AsyncStorage with NO network
 * round-trip, so Screen 3 can decide routing on every entry (mount or re-focus)
 * without ever gating interactivity on Supabase.
 */
export async function getLocalOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Persist the local onboarded flag (called when onboarding completes). */
export async function setLocalOnboarded(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, value ? 'true' : 'false');
  } catch {
    // best-effort; a missed write just means one extra DB check next entry
  }
}

/**
 * Onboarded == taste prefs saved. We use pref_cuisine_id (required by Taste
 * Setup) as the marker, so no schema flag is needed.
 */
export async function isOnboarded(): Promise<boolean> {
  const id = await getCurrentUserId();
  const { data } = await supabase
    .from('users')
    .select('pref_cuisine_id')
    .eq('id', id)
    .single();
  return !!data?.pref_cuisine_id;
}

export async function getCurrentUserId(): Promise<string> {
  if (cachedId) return cachedId;
  if (inflight) return inflight;

  inflight = (async () => {
    // Read the existing Supabase session — persisted by the auth storage
    // configured in lib/supabase.ts, so no network round-trip when one exists.
    // Timeout-guarded so a stalled network call can never hang startup.
    const {
      data: { session },
    } = await withTimeout(supabase.auth.getSession());
    if (session?.user) {
      cachedId = session.user.id;
      return cachedId;
    }

    // No session: sign-up is required before any screen that needs an identity,
    // so we NEVER create one here. Reject cleanly — callers behind the gate show
    // a calm error. (The splash routes a no-session user to /welcome first.)
    inflight = null; // allow a later retry once a session exists
    throw new Error('no_session');
  })();

  // Reset the memo on rejection (incl. timeout) so a retry actually re-attempts
  // instead of re-awaiting a poisoned promise.
  inflight.catch(() => {
    inflight = null;
  });

  return inflight;
}

/**
 * Clear the in-memory identity memo so the next getCurrentUserId() re-derives
 * identity from Supabase. Pair with supabase.auth.signOut() (the "Start over" /
 * "Log out" reset) so the next entry resolves the new (or absent) session.
 */
export function resetCurrentUser(): void {
  cachedId = null;
  inflight = null;
}

/**
 * Read the current auth user, or null if there's no session. `isAnonymous` is
 * retained so the splash can detect and evict a LEGACY anonymous session left
 * over from before the required-sign-up gate (new accounts are never anon).
 * Timeout-guarded like the rest.
 */
export async function getAuthUser(): Promise<
  { id: string; email: string | null; isAnonymous: boolean } | null
> {
  const {
    data: { session },
  } = await withTimeout(supabase.auth.getSession());
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: user.is_anonymous ?? (user.email == null),
  };
}
