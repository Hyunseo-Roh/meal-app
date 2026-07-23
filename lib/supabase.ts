import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly at startup rather than silently shipping a broken client.
if (!supabaseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL. Set it in .env (see CLAUDE.md) and restart the dev server.',
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Paste the anon key into .env and restart the dev server.',
  );
}

// On native (android/ios) use AsyncStorage as before. On web during SSR there
// is no `window`, and AsyncStorage's web backend touches it on read — which
// crashes boot with "ReferenceError: window is not defined". In that case skip
// the storage adapter (supabase falls back to its own browser default on the
// client). Native behavior is unchanged.
const isServerWeb = Platform.OS === 'web' && typeof window === 'undefined';
const storage = isServerWeb ? undefined : AsyncStorage;

// ---------------------------------------------------------------------------
// Retry policy — exactly ONE retry, project-wide, in one place.
//
// postgrest-js retries transient GET failures 3x with 1s/2s/4s backoff (~7s of
// silence before the error state shows — a stalled app, not a loading state).
// Its count isn't configurable (retry is boolean-only, DEFAULT_MAX_RETRIES is a
// private const, and supabase-js doesn't forward the option). So we DISABLE its
// built-in retry (below) and do a single retry here: one extra attempt after
// ~1s for idempotent reads (GET/HEAD/OPTIONS), and none for writes/RPC
// (POST/PATCH/DELETE) — which already never retried. This is the whole app's
// policy; nothing is set per-call, so it can't drift as screens are added.
// ---------------------------------------------------------------------------
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRY_DELAY_MS = 1000;

const singleRetryFetch: typeof fetch = async (input, init) => {
  const method = (
    init?.method ??
    (typeof input === 'object' && input !== null && 'method' in input
      ? (input as Request).method
      : 'GET')
  ).toUpperCase();
  try {
    return await fetch(input, init);
  } catch (err) {
    // One retry, and only for idempotent reads that weren't deliberately aborted.
    if (!RETRYABLE_METHODS.has(method) || init?.signal?.aborted) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await fetch(input, init);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: singleRetryFetch },
});

// Turn OFF postgrest-js's built-in 3-retry so `singleRetryFetch` is the ONLY
// retry policy (otherwise the two compound to ~8 attempts). supabase-js doesn't
// expose this option, so we set it on the (protected) rest client directly; its
// `from()` reads `retry` per call, so this applies to every future select.
(supabase as unknown as { rest: { retry?: boolean } }).rest.retry = false;
