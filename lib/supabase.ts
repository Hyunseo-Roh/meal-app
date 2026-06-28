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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
