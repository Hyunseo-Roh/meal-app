import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

/**
 * Per-device anonymous identity. On first run we silently mint a UUID, insert a
 * cold-start `users` row, and remember the id in AsyncStorage so it's stable
 * across reloads — no login wall, no sign-up screen (CLAUDE.md decision #5).
 *
 * This module never runs at import time; `getCurrentUserId()` is only awaited
 * from client effects / event handlers, so it is web-SSR safe.
 */

const STORAGE_KEY = 'app_user_id';

// In-memory memo so concurrent callers in one session share a single create.
let cachedId: string | null = null;
let inflight: Promise<string> | null = null;

function uuidv4(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback for runtimes without crypto.randomUUID (good enough for an
  // anonymous device id, which is not security-sensitive).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
    let id = await AsyncStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uuidv4();
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }

    // Ensure the row EXISTS before we hand the id to any FK write. A stored id
    // can point to a user row that was deleted out from under us (e.g. a
    // previous run / test cleanup), which otherwise causes a 409 FK violation
    // on the first dependent insert (pantry, requests). upsert with
    // ignoreDuplicates is idempotent: it creates a cold-start row if missing
    // and leaves an existing row (and its prefs) untouched.
    const { error } = await supabase.from('users').upsert(
      {
        id,
        disliked_ingredients: [],
        disliked_cuisine_ids: [],
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) {
      inflight = null; // allow a later retry
      throw new Error('user_create_failed');
    }

    cachedId = id;
    return id;
  })();

  return inflight;
}
