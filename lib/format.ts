/**
 * Single source of truth for cost display.
 *
 * est_cost is stored as DOLLARS PER SERVING (Spoonacular ingredient cost per
 * serving). It is rendered with an approx marker + "/ serving" so it never
 * reads as a whole-meal price. Display only — the stored value is untouched.
 */
export function formatCost(estCost: number): string {
  return `≈ $${estCost.toFixed(2)} / serving`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Terse absolute date for the History list, e.g. "Jul 10" (no year — recency
 * reads fine without it). Manual month array rather than Intl so it's identical
 * across Hermes/web with no locale surprises. Returns '' for a bad/empty date.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Month header label for the grouped History list, e.g. "July". Rendered through
 * the caption role, which uppercases it → "JULY" (matches PROTEINS / QUICK ADD).
 * Returns '' for a bad/empty date.
 */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return MONTH_NAMES[d.getMonth()];
}

/**
 * Stable year+month key for grouping ("2026-6"). Year-scoped so July 2025 and
 * July 2026 never merge into one section even though both display as "JULY".
 */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}`;
}
