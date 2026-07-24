/**
 * Ephemeral in-session signals (module-level, same JS runtime as the app, never
 * persisted). Currently: a "meal decision was completed" flag.
 *
 * The 3-swap cap is scoped to ONE meal decision, not one app launch. When the
 * user reaches the Handled screen (a completed decision), we set the flag; Home
 * consumes it on next focus and starts the next meal with a fresh swap budget.
 * A swap spent at lunch must not still be gone at dinner.
 */
let mealCompleted = false;

/** Mark that a meal decision was completed (call from the Handled screen). */
export function markMealCompleted(): void {
  mealCompleted = true;
}

/** Read-and-clear the completed-meal flag. Returns true once per completion. */
export function consumeMealCompleted(): boolean {
  const v = mealCompleted;
  mealCompleted = false;
  return v;
}

// "Password was just changed" — set on the change-password screen, consumed by
// Profile on next focus to show a transient confirmation. Same one-shot pattern.
let passwordChanged = false;

/** Mark that the password was changed (call from the change-password screen). */
export function markPasswordChanged(): void {
  passwordChanged = true;
}

/** Read-and-clear the password-changed flag. Returns true once per change. */
export function consumePasswordChanged(): boolean {
  const v = passwordChanged;
  passwordChanged = false;
  return v;
}
