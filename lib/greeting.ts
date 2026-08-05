/**
 * Time-of-day greeting for the request screen heading. DISPLAY ONLY — this
 * changes nothing about which meals are recommended, nor any request parameter
 * or filter. (Meal-specific, meal-time-aware recommendations would need per-meal
 * meal-time tags + a reseed; out of scope.)
 *
 * Pure and testable: derives solely from the given Date's LOCAL hours.
 *   05:00–10:59 → breakfast
 *   11:00–16:59 → lunch
 *   17:00–04:59 → dinner (late night rolls into dinner)
 */
export type MealBucket = 'breakfast' | 'lunch' | 'dinner';

/**
 * The session's meal bucket from the given Date's LOCAL hours. Single source of
 * the thresholds (5 / 11 / 17) — reused to fill downstream copy so screens match
 * the greeting. DISPLAY ONLY.
 */
export function getMealBucket(date: Date): MealBucket {
  const hours = date.getHours();
  if (hours >= 5 && hours < 11) return 'breakfast';
  if (hours >= 11 && hours < 17) return 'lunch';
  return 'dinner';
}

// Home shows the answer, not the question, so its heading names the meal slot
// ("Here's {meal}") — same time-of-day thresholds as getMealBucket. Late night
// (17:00–04:59) rolls into dinner; there is no separate late-bite bucket.
const SLOT_LABEL: Record<MealBucket, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
};

export function getPicksHeading(date: Date): string {
  // Deterministic two-line break after the comma — the full phrase is too long
  // for one line at 24px serif, so we control where it wraps instead of letting
  // it break mid-word ("…for" clipped). Line 1: "Here's {meal},"  Line 2: "sorted for you".
  return `Here's ${SLOT_LABEL[getMealBucket(date)]},\nsorted for you`;
}
