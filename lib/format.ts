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

/**
 * Spoonacular serves the same image at larger sizes. Upsize the seeded
 * "312x231" thumbnail to "636x393" so it isn't blurry when shown large.
 * Display only — the stored URL is untouched; unmatched URLs return unchanged.
 */
export function upsizeImageUrl(url: string): string {
  return url.replace('-312x231.', '-636x393.');
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
