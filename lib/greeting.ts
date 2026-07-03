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
export function getMealGreeting(date: Date): string {
  const hours = date.getHours();
  if (hours >= 5 && hours < 11) return "What's for breakfast?";
  if (hours >= 11 && hours < 17) return "What's for lunch?";
  return "What's for dinner?";
}
