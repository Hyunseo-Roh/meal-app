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
