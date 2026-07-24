/**
 * Maps a Supabase auth error to OUR copy. We never render the provider's raw
 * message (it's off-voice and can leak technical detail) — we identify by the
 * stable error `code` and fall back to one calm line for anything unmapped.
 *
 * Wrong password and unknown email both arrive as `invalid_credentials`, so they
 * share one message — never revealing which half was wrong. A malformed email on
 * sign-IN also collapses into `invalid_credentials`; on sign-UP it's
 * `validation_failed`, which we can name.
 *
 * Same voice rules as the rest of the app: no "we", no blame, no technical
 * cause, no trailing period, retry deferred to the button.
 */
type AuthErrorLike = { code?: string | null } | null | undefined;

export function authErrorMessage(error: AuthErrorLike): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match';
    case 'user_already_exists':
      return 'That email is already registered';
    case 'weak_password':
      return 'Your password needs at least 6 characters';
    case 'validation_failed':
      return 'That email doesn’t look right';
    default:
      return 'That didn’t go through';
  }
}

/** True when the failure is specifically an already-registered email. */
export function isEmailInUse(error: AuthErrorLike): boolean {
  return error?.code === 'user_already_exists';
}

/**
 * Change-password copy. The reauth step signs in with the CURRENT user's known
 * email, so an `invalid_credentials` there is unambiguously a wrong current
 * password — named specifically rather than the shared login line. The
 * updateUser step can return `weak_password` (too short) or `same_password`
 * (new == old, though we also guard that client-side). Same voice rules.
 */
export function changePasswordErrorMessage(error: AuthErrorLike): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'That’s not your current password';
    case 'weak_password':
      return 'Your password needs at least 6 characters';
    case 'same_password':
      return 'Your new password needs to be different';
    default:
      return 'That didn’t go through';
  }
}
