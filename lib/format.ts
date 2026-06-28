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
