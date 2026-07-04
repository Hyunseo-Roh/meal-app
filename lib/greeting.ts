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

const GREETING: Record<MealBucket, string> = {
  breakfast: "What's for breakfast?",
  lunch: "What's for lunch?",
  dinner: "What's for dinner?",
};

export function getMealGreeting(date: Date): string {
  return GREETING[getMealBucket(date)];
}
