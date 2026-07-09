import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUserId, resetCurrentUser } from './currentUser';
import { supabase } from './supabase';

// Local onboarded flag (mirrors lib/currentUser.ts / profile.tsx).
const ONBOARDED_KEY = 'app_onboarded';

/**
 * Lightweight account deletion. Removes all of the user's app data via the
 * atomic delete_user_data RPC (FK order, one transaction), then tears the
 * session down exactly like "Start over" (signOut + reset memo + clear the
 * local onboarded flag). Routing to Welcome is the caller's job.
 *
 * The auth.users record is NOT removed (that needs service_role / an Edge
 * Function), so the email stays registered — a documented limitation. The
 * splash guards the re-login edge: a lingering session whose public.users row
 * is gone is sent to Welcome, never into an onboarding loop.
 *
 * Throws if the data-delete step fails, WITHOUT signing out — so a failure
 * never leaves the user half-deleted and locked out. The teardown after a
 * successful delete is best-effort (the data is already gone).
 */
export async function deleteAccount(): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.rpc('delete_user_data', { p_user_id: userId });
  if (error) throw new Error('delete_failed');

  try {
    await supabase.auth.signOut();
    resetCurrentUser();
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // Best-effort: the account data is already deleted; the splash still
    // resolves a no-session user to Welcome.
  }
}
