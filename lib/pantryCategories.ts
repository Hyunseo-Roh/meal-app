import type { PantryItem } from './pantry';

/**
 * Shared pantry classification (used by the Pantry summary + the category detail
 * screen, so they group identically). CATEGORIES order is PRECEDENCE (first
 * keyword hit wins); CATEGORY_ORDER is the DISPLAY order (decoupled). The
 * grouping key is `item.category ?? categorize(name)` — a stored override wins,
 * NULL falls back to the name heuristic.
 */
const CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: 'Proteins', keywords: ['chicken', 'beef', 'pork', 'shrimp', 'prawn', 'fish', 'salmon', 'tuna', 'cod', 'egg', 'tofu', 'bean', 'lentil', 'chickpea', 'turkey', 'duck', 'lamb', 'mutton', 'bacon', 'sausage', 'ham', 'meat', 'oyster', 'clam', 'crab', 'mussel', 'scallop', 'squid'] },
  { label: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'cream', 'parmesan', 'mozzarella', 'feta', 'butter'] },
  { label: 'Fats & oils', keywords: ['oil', 'ghee', 'lard', 'margarine', 'shortening'] },
  { label: 'Grains', keywords: ['rice', 'pasta', 'noodle', 'bread', 'flour', 'oat', 'quinoa', 'tortilla', 'cereal', 'couscous', 'barley', 'bagel', 'cracker'] },
  { label: 'Produce', keywords: ['onion', 'garlic', 'tomato', 'carrot', 'broccoli', 'spinach', 'lettuce', 'potato', 'mushroom', 'cucumber', 'celery', 'zucchini', 'cabbage', 'kale', 'corn', 'pea', 'pepper', 'bell', 'apple', 'banana', 'lemon', 'lime', 'orange', 'berry', 'grape', 'mango', 'avocado', 'peach', 'pear', 'herb', 'cilantro', 'parsley', 'scallion', 'ginger'] },
  { label: 'Seasonings', keywords: ['salt', 'sauce', 'soy', 'vinegar', 'spice', 'cumin', 'paprika', 'oregano', 'basil', 'honey', 'sugar', 'sesame', 'chili', 'curry', 'stock', 'broth', 'ketchup', 'mustard', 'mayo'] },
];

// Display order (independent of the precedence order above).
export const CATEGORY_ORDER = ['Proteins', 'Produce', 'Grains', 'Dairy', 'Fats & oils', 'Seasonings', 'Other'];

/** Name-keyword heuristic fallback; first hit wins, else 'Other'. */
export function categorize(name: string): string {
  const n = name.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keywords.some((k) => n.includes(k))) return c.label;
  }
  return 'Other';
}

/** Grouping key: a stored category override wins; NULL → the name heuristic. */
export function categoryOf(item: PantryItem): string {
  return item.category ?? categorize(item.name);
}

/** Display-only sentence case for a category label. */
export function toSentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}
