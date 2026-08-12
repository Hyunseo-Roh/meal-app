// THROWAWAY probe — Lever 1 investigation. Do NOT commit. Read-only, no DB writes.
import { readFileSync } from 'node:fs';

// --- load secrets without printing them ---
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const SPOON_KEY = env.SPOONACULAR_API_KEY;
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SB_ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SPOON_KEY || !SB_URL || !SB_ANON) {
  console.error('missing secrets'); process.exit(1);
}

const norm = (s) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
const sbHeaders = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

// --- 2. dedupe prep: inspect one row to find columns ---
const sampleRes = await fetch(`${SB_URL}/rest/v1/meals?select=*&limit=1`, { headers: sbHeaders });
const sample = await sampleRes.json();
const cols = sample[0] ? Object.keys(sample[0]) : [];
const titleCol = cols.includes('title') ? 'title' : cols.includes('name') ? 'name' : null;
const cuisineCol = cols.find((c) => /cuisine/i.test(c)) ?? null;
console.log('meals columns:', cols.join(', '));
console.log('title column:', titleCol, '| cuisine column:', cuisineCol);
console.log('');

// pull all existing titles
const allRes = await fetch(
  `${SB_URL}/rest/v1/meals?select=${titleCol}${cuisineCol ? ',' + cuisineCol : ''}`,
  { headers: sbHeaders }
);
const allRows = await allRes.json();
const existing = new Set(allRows.map((r) => norm(r[titleCol])));
console.log(`existing catalog: ${allRows.length} meals, ${existing.size} normalized titles`);
console.log('');

// --- 3. one complexSearch per cuisine, instrument quota ---
const cuisines = ['American', 'Mexican', 'Indian', 'Italian', 'Chinese', 'Greek'];
const EXCLUDE = ['side dish', 'sauce', 'marinade', 'dip', 'snack', 'appetizer',
  'dessert', 'beverage', 'drink', 'fingerfood', 'condiment', 'spread'];
const INCLUDE = ['main course', 'main dish', 'lunch', 'dinner'];

let firstUsed = null;
let lastUsed = null;
let lastLeft = null;
const survivorsByCuisine = {};

const RUN_BASELINE = process.env.RUN_BASELINE === '1'; // guard the original 6 Spoonacular calls
for (const c of (RUN_BASELINE ? cuisines : [])) {
  const url = `https://api.spoonacular.com/recipes/complexSearch?cuisine=${encodeURIComponent(c)}` +
    `&type=${encodeURIComponent('main course')}&addRecipeInformation=true&number=6` +
    `&sort=popularity&maxReadyTime=30&apiKey=${SPOON_KEY}`;
  const res = await fetch(url);
  const used = res.headers.get('x-api-quota-used');
  const left = res.headers.get('x-api-quota-left');
  if (firstUsed === null && used !== null) firstUsed = parseFloat(used);
  if (used !== null) lastUsed = parseFloat(used);
  if (left !== null) lastLeft = parseFloat(left);
  const body = await res.json();
  const results = body.results ?? [];
  console.log(`[${c}] HTTP ${res.status} | raw results: ${results.length} | quota-used: ${used} | quota-left: ${left}`);

  const survivors = results.filter((r) => {
    const rt = r.readyInMinutes;
    if (!(rt >= 16 && rt <= 30)) return false;
    const dt = (r.dishTypes ?? []).map((d) => d.toLowerCase());
    if (!dt.some((d) => INCLUDE.includes(d))) return false;
    if (dt.some((d) => EXCLUDE.includes(d))) return false;
    if (!r.image) return false;
    if (existing.has(norm(r.title))) return false;
    return true;
  });
  survivorsByCuisine[c] = survivors;
}

console.log('');
console.log('===== SURVIVORS =====');
for (const c of (RUN_BASELINE ? cuisines : [])) {
  const s = survivorsByCuisine[c];
  console.log('');
  if (!s.length) {
    console.log(`${c}: 0 survivors`);
    continue;
  }
  console.log(`${c}:`);
  console.log('  ' + ['title', 'readyInMinutes', 'spoonacularId'].join(' | '));
  for (const r of s) {
    console.log('  ' + [r.title, r.readyInMinutes, r.id].join(' | '));
  }
}

if (RUN_BASELINE) {
  console.log('');
  const spent = (firstUsed !== null && lastUsed !== null) ? (lastUsed - firstUsed).toFixed(2) : 'n/a';
  console.log(`points spent this run (used delta over ${cuisines.length} calls): ${spent}`);
  console.log(`final X-API-Quota-Left: ${lastLeft}`);
}

// ============================================================
// WIDEN PHASE — Italian + Chinese only. Reuses catalog Set above.
// Also excludes the 19 survivors from the previous run so only NEW titles show.
// ============================================================
if (process.env.RUN_WIDEN === '1') {
console.log('\n\n########## WIDEN PHASE (Italian + Chinese) ##########\n');

const priorSurvivorTitles = [
  // American
  'Asian Salmon Burgers With Tangy Ginger Lime Sauce', 'Chicken Ranch Burgers', 'La Bella Italian Turkey Burger',
  // Mexican
  'Instant Pot Chicken Tacos', 'The Secret to Easy Skillet Filet Mignon Steak Tacos', 'Instant Pot Chicken Taco Soup',
  // Indian
  'Cashew Butter Chicken', 'Fish Fillet In Creamy Coconut Curry', 'Curry Mee Noodle Soup',
  'Vegan Chana Masala Curry', 'Luscious Palak Paneer', 'Curry Chicken Salad',
  // Italian
  'Linguine Alla Carbonara', 'Vegetable Minestrone Soup',
  // Chinese
  'Korean Sweet n Sour Chicken',
  // Greek
  'Greek-Style Baked Fish: Fresh, Simple, and Delicious', 'Light Greek Lemon Chicken Orzo Soup',
  'Greek Yogurt Chicken Salad', 'Greek Inspired Spring Omelet',
];
const prior = new Set(priorSurvivorTitles.map(norm));

const widenCalls = [
  { cuisine: 'Italian', url: `https://api.spoonacular.com/recipes/complexSearch?cuisine=Italian&type=${encodeURIComponent('main course')}&addRecipeInformation=true&number=12&sort=popularity&maxReadyTime=30&apiKey=${SPOON_KEY}` },
  { cuisine: 'Chinese', url: `https://api.spoonacular.com/recipes/complexSearch?cuisine=Chinese&addRecipeInformation=true&number=12&sort=popularity&maxReadyTime=30&apiKey=${SPOON_KEY}` },
];

const widenSurvivors = {};
let wLeft = null;
let wFirstUsed = null;
let wLastUsed = null;

for (const { cuisine, url } of widenCalls) {
  const res = await fetch(url);
  const used = res.headers.get('x-api-quota-used');
  const left = res.headers.get('x-api-quota-left');
  if (used !== null) { if (wFirstUsed === null) wFirstUsed = parseFloat(used); wLastUsed = parseFloat(used); }
  if (left !== null) wLeft = parseFloat(left);
  const body = await res.json();
  const results = body.results ?? [];
  console.log(`[${cuisine}] HTTP ${res.status} | raw results: ${results.length} | quota-used: ${used} | quota-left: ${left}`);

  widenSurvivors[cuisine] = results.filter((r) => {
    const rt = r.readyInMinutes;
    if (!(rt >= 16 && rt <= 30)) return false;
    const dt = (r.dishTypes ?? []).map((d) => d.toLowerCase());
    if (!dt.some((d) => INCLUDE.includes(d))) return false;
    if (dt.some((d) => EXCLUDE.includes(d))) return false;
    if (!r.image) return false;
    const n = norm(r.title);
    if (existing.has(n)) return false;
    if (prior.has(n)) return false;
    return true;
  });
}

console.log('\n===== NEW SURVIVORS (widen) =====');
for (const { cuisine } of widenCalls) {
  const s = widenSurvivors[cuisine];
  console.log('');
  if (!s.length) {
    console.log(`${cuisine}: 0 NEW survivors`);
    continue;
  }
  console.log(`${cuisine}:`);
  console.log('  ' + ['title', 'readyInMinutes', 'spoonacularId'].join(' | '));
  for (const r of s) console.log('  ' + [r.title, r.readyInMinutes, r.id].join(' | '));
}

console.log('');
// wLastUsed - wFirstUsed = delta across calls 2..n; add ~one call to include call A.
console.log(`widen quota-used: first call ${wFirstUsed}, last call ${wLastUsed} (delta across 2 calls = ${(wLastUsed - wFirstUsed).toFixed(2)}, ~= cost of call B; total run ≈ 2 calls)`);
console.log(`final X-API-Quota-Left: ${wLeft}`);
} // end WIDEN PHASE

// ============================================================
// DETAIL PHASE — heavy informationBulk pull to local file + schema investigation.
// Read-only w.r.t. the DB. No inserts. Gated by RUN_DETAIL=1.
// ============================================================
if (process.env.RUN_DETAIL === '1') {
console.log('\n\n########## DETAIL PHASE ##########\n');

// 19 locked survivor ids from run 1
const LOCKED = {
  American: [632874, 991010, 649141],
  Mexican: [986003, 1063645, 982382],
  Indian: [637264, 642941, 1096180, 1096306, 650484, 650378],
  Italian: [650119, 664565],
  Chinese: [638369],
  Greek: [716408, 1098350, 645384, 645315],
};
const idToBucket = {};
for (const [bucket, ids] of Object.entries(LOCKED)) for (const id of ids) idToBucket[id] = bucket;
const allIds = Object.values(LOCKED).flat();
console.log(`locked ids: ${allIds.length} (${Object.entries(LOCKED).map(([k, v]) => k + ':' + v.length).join(', ')})`);

// --- PART A: informationBulk (ONE heavy call) ---
const bulkUrl = `https://api.spoonacular.com/recipes/informationBulk?ids=${allIds.join(',')}&includeNutrition=false&apiKey=${SPOON_KEY}`;
const bulkRes = await fetch(bulkUrl);
console.log(`informationBulk HTTP ${bulkRes.status} | X-API-Quota-Used: ${bulkRes.headers.get('x-api-quota-used')} | X-API-Quota-Left: ${bulkRes.headers.get('x-api-quota-left')}`);
const detail = await bulkRes.json();
const { writeFileSync } = await import('node:fs');
const outPath = new URL('./_lever1_detail.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(detail, null, 2));
console.log(`wrote ${Array.isArray(detail) ? detail.length : 'ERR'} recipes to scripts/_lever1_detail.json`);
const finalLeft = bulkRes.headers.get('x-api-quota-left');

// --- PART B: schema investigation (Supabase, free) ---
console.log('\n----- PART B.1: meals full columns (2 rows) -----');
const mRes = await fetch(`${SB_URL}/rest/v1/meals?select=*&limit=2`, { headers: sbHeaders });
const mRows = await mRes.json();
for (const [i, row] of mRows.entries()) {
  console.log(`  meals row ${i}:`);
  for (const [k, v] of Object.entries(row)) {
    const disp = Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' && v.length > 60 ? v.slice(0, 60) + '…' : v;
    console.log(`    ${k}: ${disp}`);
  }
}

console.log('\n----- PART B.2: meal_ingredients columns (3 rows) -----');
const miRes = await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=*&limit=3`, { headers: sbHeaders });
const miRows = await miRes.json();
console.log(`  columns: ${miRows[0] ? Object.keys(miRows[0]).join(', ') : '(none)'}`);
for (const row of miRows) console.log(`    ${JSON.stringify(row)}`);

console.log('\n----- PART B.3: cuisines lookup table -----');
const cRes = await fetch(`${SB_URL}/rest/v1/cuisines?select=*`, { headers: sbHeaders });
let cuisineMap = {};
if (cRes.ok) {
  const cRows = await cRes.json();
  if (Array.isArray(cRows) && cRows.length) {
    for (const row of cRows) {
      const nameKey = row.name ?? row.display_label;
      cuisineMap[String(nameKey).toLowerCase()] = row.id;
      console.log(`    ${row.id}  ↔  ${row.name}${row.display_label ? ' (' + row.display_label + ')' : ''}${row.emoji ? ' ' + row.emoji : ''}`);
    }
  } else {
    console.log('    cuisines table empty or not present; distinct cuisine_id on meals:');
    const dRes = await fetch(`${SB_URL}/rest/v1/meals?select=cuisine_id`, { headers: sbHeaders });
    const dRows = await dRes.json();
    console.log('    ' + [...new Set(dRows.map((r) => r.cuisine_id))].join('\n    '));
  }
} else {
  console.log(`    no cuisines table (HTTP ${cRes.status}); mapping by hand from meals.cuisine_id`);
}

// --- PART B.4: field coverage for the 19 pulled recipes ---
console.log('\n----- PART B.4: required-column coverage from Spoonacular -----');
const mealCols = mRows[0] ? Object.keys(mRows[0]) : [];
console.log(`  meals columns to fill on insert: ${mealCols.join(', ')}`);
// Map each meals column → how we'd source it from a Spoonacular recipe object
const sourcing = {
  id: 'DB default (gen_random_uuid) — do not supply',
  name: 'recipe.title ✓',
  cuisine_id: 'DERIVE: map bucket → cuisines.id (hand map)',
  effort_level: 'DERIVE: default (e.g. from readyInMinutes / step count) — NOT in Spoonacular directly',
  cook_time_min: 'recipe.readyInMinutes ✓',
  est_cost: 'DERIVE/DEFAULT: recipe.pricePerServing (cents) → convert, or default budget',
  image_url: 'recipe.image ✓',
  source: "DEFAULT: 'spoonacular'",
  external_id: 'recipe.id ✓ (unique)',
  dietary_tags: 'DERIVE: from recipe flags (vegetarian/vegan/glutenFree/dairyFree) ✓ partial',
  description: 'recipe.summary (strip HTML) ✓',
  instructions: 'recipe.analyzedInstructions / instructions ✓',
};
if (Array.isArray(detail)) {
  const sample = detail[0] ?? {};
  console.log(`  sample recipe keys available: ${Object.keys(sample).slice(0, 40).join(', ')}`);
  for (const col of mealCols) {
    console.log(`    ${col.padEnd(14)} ← ${sourcing[col] ?? '??? unmapped'}`);
  }
}

// --- readiness summary + cuisine-tag disagreements ---
console.log('\n----- READINESS SUMMARY -----');
if (Array.isArray(detail)) {
  const perBucket = {};
  const disagreements = [];
  for (const r of detail) {
    const bucket = idToBucket[r.id];
    perBucket[bucket] = (perBucket[bucket] ?? 0) + 1;
    const tags = (r.cuisines ?? []).map((x) => x.toLowerCase());
    if (tags.length && !tags.includes(bucket.toLowerCase())) {
      disagreements.push(`${r.title} (id ${r.id}) filed under ${bucket}, Spoonacular cuisines: [${(r.cuisines ?? []).join(', ') || 'none'}]`);
    } else if (!tags.length) {
      disagreements.push(`${r.title} (id ${r.id}) filed under ${bucket}, Spoonacular cuisines: [none tagged]`);
    }
  }
  console.log('  per-bucket count: ' + Object.entries(perBucket).map(([k, v]) => k + ':' + v).join(', '));
  console.log('  cuisine-tag disagreements:');
  if (disagreements.length) for (const d of disagreements) console.log('    - ' + d);
  else console.log('    (none)');
}
console.log(`\n  final X-API-Quota-Left: ${finalLeft}`);
} // end DETAIL PHASE
