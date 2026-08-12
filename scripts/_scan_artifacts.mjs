// THROWAWAY — read-only step/ingredient artifact scan. No DB writes. Do NOT commit.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SB_ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

const meals = await (await fetch(`${SB_URL}/rest/v1/meals?select=name,external_id,instructions`, { headers: h })).json();
const ingsRaw = await (await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=meal_id,name`, { headers: h })).json();
// meal_id -> name lookup for example labels (meals REST has no id in our select; pull id too)
const mealsWithId = await (await fetch(`${SB_URL}/rest/v1/meals?select=id,name`, { headers: h })).json();
const idToName = Object.fromEntries(mealsWithId.map((m) => [m.id, m.name]));

console.log(`scanned: ${meals.length} meals, ${ingsRaw.length} ingredient rows`);

// ----- classifiers -----
const ACCENT_TRUNC = /\b(saut|jalapeno|puree|creme|souffle|flambe|nicoise|entree)\b/i;
const HTML = /&[a-z]+;|&#\d+;|<\/?[a-z][^>]*>/i;
const NON_ASCII = /[^\x00-\x7F]/;
const REPLACEMENT = /�/;
// common mojibake sequences (UTF-8 read as latin1): Ã©, Ã¨, Ã¢, â€™, etc.
const MOJIBAKE = /Ã.|â€.|Â./;

// issue buckets: type -> Map(offendingString -> {count, example})
const buckets = {
  accent_truncation: new Map(),
  html_entity_or_tag: new Map(),
  non_ascii: new Map(),
  replacement_char: new Map(),
  mojibake: new Map(),
  double_space: new Map(),
  edge_whitespace: new Map(),
  empty_string: new Map(),
};

const affectedStepMeals = new Set();
let affectedStepCount = 0;

function record(bucket, str, exampleMeal) {
  const m = buckets[bucket];
  const key = str;
  if (m.has(key)) m.get(key).count++;
  else m.set(key, { count: 1, example: exampleMeal });
}

// classify a single string; returns true if any issue found
function classify(str, exampleMeal) {
  let hit = false;
  if (str === '') { record('empty_string', '(empty)', exampleMeal); return true; }
  if (REPLACEMENT.test(str)) { record('replacement_char', str, exampleMeal); hit = true; }
  if (MOJIBAKE.test(str)) { record('mojibake', str, exampleMeal); hit = true; }
  if (HTML.test(str)) { record('html_entity_or_tag', (str.match(HTML) || [str])[0], exampleMeal); hit = true; }
  if (ACCENT_TRUNC.test(str)) { record('accent_truncation', (str.match(ACCENT_TRUNC) || [str])[0].toLowerCase(), exampleMeal); hit = true; }
  if (NON_ASCII.test(str) && !MOJIBAKE.test(str)) { record('non_ascii', str, exampleMeal); hit = true; }
  if (/ {2,}/.test(str)) { record('double_space', '(double space)', exampleMeal); hit = true; }
  if (str !== str.trim()) { record('edge_whitespace', '(edge whitespace)', exampleMeal); hit = true; }
  return hit;
}

// ----- scan step strings -----
for (const meal of meals) {
  const steps = Array.isArray(meal.instructions) ? meal.instructions : [];
  let mealHit = false;
  for (const s of steps) {
    if (classify(s ?? '', meal.name)) { affectedStepCount++; mealHit = true; }
  }
  if (mealHit) affectedStepMeals.add(meal.name);
}

// ----- scan ingredient names -----
const affectedIngMeals = new Set();
let affectedIngCount = 0;
for (const ing of ingsRaw) {
  const label = idToName[ing.meal_id] ?? '(unknown meal)';
  if (classify(ing.name ?? '', label)) { affectedIngCount++; affectedIngMeals.add(label); }
}

// ----- report -----
const LABELS = {
  accent_truncation: 'Accent-truncated words (accent stripped)',
  html_entity_or_tag: 'Leftover HTML entities / tags',
  non_ascii: 'Non-ASCII characters (true accents / symbols)',
  replacement_char: 'Unicode replacement char (\\uFFFD)',
  mojibake: 'Mojibake (UTF-8 misdecoded)',
  double_space: 'Double spaces',
  edge_whitespace: 'Leading/trailing whitespace',
  empty_string: 'Empty strings',
};

for (const [type, map] of Object.entries(buckets)) {
  console.log(`\n===== ${LABELS[type]} — ${map.size} distinct, ${[...map.values()].reduce((a, b) => a + b.count, 0)} total =====`);
  if (map.size === 0) { console.log('  (none)'); continue; }
  const rows = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [str, info] of rows) {
    const shown = str.length > 90 ? str.slice(0, 90) + '…' : str;
    console.log(`  [x${info.count}] ${JSON.stringify(shown)}   e.g. "${info.example}"`);
  }
}

console.log('\n===== TOTALS =====');
console.log(`affected step strings: ${affectedStepCount}  across ${affectedStepMeals.size} meals`);
console.log(`affected ingredient names: ${affectedIngCount}  across ${affectedIngMeals.size} meals`);
console.log(`affected step-carrying meals: ${[...affectedStepMeals].join(', ') || '(none)'}`);
