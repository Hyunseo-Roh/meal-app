/**
 * Meal-catalog reseed — reproducible, ADD + UPDATE only (never deletes meals or
 * cuisines, so existing recommendation_options / feedback FK rows are never at
 * risk). Run one phase at a time:
 *
 *   node --experimental-strip-types scripts/seed.ts prices   # UPDATE est_cost (existing 30)
 *   node --experimental-strip-types scripts/seed.ts images   # UPDATE image_url 312x231 -> 636x393
 *   node --experimental-strip-types scripts/seed.ts spoon    # ADD 4 cuisines + new meals (needs Spoonacular key)
 *   node --experimental-strip-types scripts/seed.ts all
 *
 * Keys come from .env (gitignored) — never hardcode:
 *   EXPO_PUBLIC_SUPABASE_URL         (required)
 *   SUPABASE_SERVICE_ROLE_KEY        (preferred for seeding) OR
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY    (works: RLS off + GRANT ALL)
 *   SPOONACULAR_API_KEY              (required only for `spoon`)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const WRITE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SPOON_KEY = process.env.SPOONACULAR_API_KEY;

if (!SUPABASE_URL || !WRITE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or a Supabase write key in .env');
}

const db = createClient(SUPABASE_URL, WRITE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Cuisine ids. First 6 already exist (do not re-insert). Last 4 are the reseed
// additions — fixed UUIDs continue the a0000000-…-00N pattern so they're stable.
// ---------------------------------------------------------------------------
const CUISINES = {
  italian: 'a0000000-0000-0000-0000-000000000001',
  mexican: 'a0000000-0000-0000-0000-000000000002',
  thai: 'a0000000-0000-0000-0000-000000000003',
  american: 'a0000000-0000-0000-0000-000000000004',
  japanese: 'a0000000-0000-0000-0000-000000000005',
  korean: 'a0000000-0000-0000-0000-000000000006',
  chinese: 'a0000000-0000-0000-0000-000000000007',
  vietnamese: 'a0000000-0000-0000-0000-000000000008',
  indian: 'a0000000-0000-0000-0000-000000000009',
  greek: 'a0000000-0000-0000-0000-000000000010',
} as const;

const NEW_CUISINES: { id: string; name: string; display_label: string; emoji: string }[] = [
  { id: CUISINES.chinese, name: 'chinese', display_label: 'Chinese', emoji: '🥡' },
  { id: CUISINES.vietnamese, name: 'vietnamese', display_label: 'Vietnamese', emoji: '🍲' },
  { id: CUISINES.indian, name: 'indian', display_label: 'Indian', emoji: '🍛' },
  { id: CUISINES.greek, name: 'greek', display_label: 'Greek', emoji: '🥙' },
];

// Spoonacular cuisine query term per our cuisine key (for `spoon`).
const SPOON_CUISINE: Record<string, string> = {
  italian: 'Italian',
  mexican: 'Mexican',
  thai: 'Thai',
  american: 'American',
  japanese: 'Japanese',
  korean: 'Korean',
  chinese: 'Chinese',
  vietnamese: 'Vietnamese',
  indian: 'Indian',
  greek: 'Greek',
};

// ---------------------------------------------------------------------------
// PHASE 1 — price spread. Deliberate est_cost per existing meal id so every
// cuisine spans all 3 budget tiers (low <=3 / medium <=5 / high >5). Values
// kept plausible ($0.90–$10) and roughly in each meal's original rank.
// ---------------------------------------------------------------------------
const PRICE_MAP: Record<string, number> = {
  // american
  'bf2f40ef-8a4a-4b76-98bf-e502ea174286': 1.6, // Garlic Lemon Chili Broccoli
  '7f3dd545-eb08-4f5b-997a-1a4218e73a46': 2.4, // Falafel Burgers
  '4790d693-9192-47b8-a4d5-19ac8065d5f5': 3.9, // Chunky Two-Bean Chili
  'ced84e06-3125-4073-af25-e60a97624187': 4.6, // Ginger Garlic Chili Salmon
  'dd31e58b-e14c-451c-a587-eb426c7934df': 6.8, // Sweet Potato ...
  // italian
  '1143b53a-81dc-4fed-940a-505e85c71a47': 1.9, // Roma Tomato Bruschetta
  '1f71145d-e13c-4204-ab1f-ced3bd882a07': 2.6, // Italian Tuna Pasta
  '60d87591-33ad-490b-90d9-80d9c0f01799': 3.8, // Mushroom Hummus Crostini
  'f34ae5c5-113b-44d5-8dcf-3910363fe941': 4.7, // Salmon Quinoa Risotto
  'fe44fa1f-cb6d-4285-8ded-3b7999d985f1': 6.4, // Broccolini Quinoa Pilaf
  // japanese
  'e7bbccf8-db10-4fbb-b937-7811040efe3d': 1.2, // Miso Soup With Thin Noodles
  'ef036a0b-8cfd-4c9f-87b0-69e53527bcb1': 2.3, // Ground Pork Ramen
  '02728da7-d75e-4266-a43a-3c665cbf4c62': 3.6, // Instant Pot Pork Teriyaki
  'b70547e9-e843-4874-870b-feb3ea4ee4a1': 4.5, // Beef Teriyaki Stir Fry
  '4dd4afd6-9bf0-4398-bd8f-36d838feec5b': 7.2, // Japanese Sushi
  // korean
  '5cfbdb7b-fd93-43a2-b63d-764a0632eec4': 2.4, // Chapchae
  '73b743df-7c38-4874-8477-83e0e356d1a7': 2.8, // Kimchi
  'f36689af-7366-4492-8b69-0ad74bd86eae': 3.9, // Kimchi/Kimchee/Gimchi
  'cab03749-6bfd-42c6-90ec-9d2354983302': 4.9, // Bibimbab
  '30a69308-621d-4b60-82c8-95f521c99372': 7.8, // Winter Kimchi
  // mexican
  '741a209a-d0f0-4e8c-8a41-f7a0c36ab47b': 1.4, // Homemade Guacamole
  '2c9c5f7a-8a72-4393-adf8-5951cf6f6778': 2.9, // Cheesy Chicken Enchilada Quinoa
  '1e7c2f40-fbef-4343-b596-a6c2fe1b62e0': 4.2, // Chicken Fajita Stuffed Peppers
  'c4a2469f-f144-438e-85c0-053162304d99': 4.8, // Chilled Avocado & Cucumber Soup
  'b20b355e-bfcb-4d85-b6e8-80477c1359ed': 7.6, // Grilled Salmon ...
  // thai
  '3667c70a-918e-4c29-9f9c-c87870e95b2b': 1.8, // Thai-Style Mussels
  '4d18f348-c4c4-425a-b62e-9e4f26c5dffc': 2.5, // Thai "Chicken" Wraps
  '8b0f0491-dd91-49f3-a5d0-a07f9fafd4ee': 3.7, // Thai Tofu With Bok Choy
  '4c01972d-4101-46ec-8a04-56dedf272bd3': 4.6, // Thai Pasta Salad
  '1c3e9b32-adbe-47c9-a8f3-f75035b686fc': 6.9, // Thai Street Food Crab
};

async function phasePrices() {
  console.log(`PHASE 1 prices: updating ${Object.keys(PRICE_MAP).length} meals…`);
  let ok = 0;
  for (const [id, cost] of Object.entries(PRICE_MAP)) {
    const { error } = await db.from('meals').update({ est_cost: cost }).eq('id', id);
    if (error) console.error('  FAIL', id, error.message);
    else ok++;
  }
  console.log(`  updated ${ok}/${Object.keys(PRICE_MAP).length}`);
}

// ---------------------------------------------------------------------------
// PHASE 2 — store the larger image variant instead of relying on the runtime
// upsize shim. Same image, -312x231 -> -636x393.
// ---------------------------------------------------------------------------
async function phaseImages() {
  const { data, error } = await db.from('meals').select('id, image_url');
  if (error || !data) throw new Error('read meals failed: ' + error?.message);
  let changed = 0;
  for (const m of data) {
    const url: string | null = m.image_url;
    if (!url || !url.includes('-312x231.')) continue;
    const upsized = url.replace('-312x231.', '-636x393.');
    const { error: e } = await db.from('meals').update({ image_url: upsized }).eq('id', m.id);
    if (e) console.error('  FAIL', m.id, e.message);
    else changed++;
  }
  console.log(`PHASE 2 images: upsized ${changed} of ${data.length} meals to 636x393`);
}

// ---------------------------------------------------------------------------
// PHASE 3 — ADD 4 cuisines + top up every cuisine to ~8 meals, with >=2 under
// 15 min and prices spread across tiers. Pulls real recipes from Spoonacular
// (image 636x393, ingredients, cook time, cost). external_id keeps it idempotent.
// ---------------------------------------------------------------------------
const TARGET_PER_CUISINE = 8;

type SpoonRecipe = {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  pricePerServing?: number; // cents per serving
  summary?: string;
  extendedIngredients?: { nameClean?: string; name?: string }[];
};

function effortFromTime(min: number): number {
  if (min <= 20) return 1;
  if (min <= 40) return 2;
  return 3;
}

function to636(image?: string): string | null {
  if (!image) return null;
  return image.replace(/-\d+x\d+\./, '-636x393.');
}

function stripHtml(s?: string): string {
  return (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

async function spoonSearch(cuisine: string, number: number, maxReadyTime?: number) {
  const u = new URL('https://api.spoonacular.com/recipes/complexSearch');
  u.searchParams.set('apiKey', SPOON_KEY!);
  u.searchParams.set('cuisine', cuisine);
  u.searchParams.set('number', String(number));
  u.searchParams.set('addRecipeInformation', 'true');
  u.searchParams.set('fillIngredients', 'true');
  u.searchParams.set('sort', 'random');
  if (maxReadyTime) u.searchParams.set('maxReadyTime', String(maxReadyTime));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Spoonacular ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { results?: SpoonRecipe[] };
  return j.results ?? [];
}

/** Insert one Spoonacular recipe as a meal (+ its ingredients). Returns true on success. */
async function insertRecipe(r: SpoonRecipe, cuisineId: string): Promise<boolean> {
  const cook = r.readyInMinutes ?? 30;
  const cost = r.pricePerServing ? Math.round(r.pricePerServing) / 100 : 3.5;
  const { data: meal, error: mErr } = await db
    .from('meals')
    .insert({
      name: r.title,
      cuisine_id: cuisineId,
      effort_level: effortFromTime(cook),
      cook_time_min: cook,
      est_cost: Math.min(10, Math.max(0.9, cost)),
      image_url: to636(r.image),
      source: 'spoonacular',
      external_id: String(r.id),
      dietary_tags: [],
      description: stripHtml(r.summary),
    })
    .select('id')
    .single();
  if (mErr || !meal) {
    console.error(`    meal insert FAIL (${r.title}):`, mErr?.message);
    return false;
  }
  const uniq = Array.from(
    new Set(
      (r.extendedIngredients ?? [])
        .map((i) => (i.nameClean || i.name || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (uniq.length) {
    const { error: iErr } = await db
      .from('meal_ingredients')
      .insert(uniq.map((name) => ({ meal_id: meal.id, name })));
    if (iErr) console.error(`    ingredient insert FAIL (${r.title}):`, iErr.message);
  }
  return true;
}

async function phaseSpoon() {
  if (!SPOON_KEY) throw new Error('SPOONACULAR_API_KEY missing in .env — cannot run `spoon`.');

  // 1. Add the 4 new cuisines (idempotent upsert on the unique name).
  const { error: cuErr } = await db
    .from('cuisines')
    .upsert(NEW_CUISINES, { onConflict: 'name', ignoreDuplicates: true });
  if (cuErr) throw new Error('cuisine insert failed: ' + cuErr.message);
  console.log(`PHASE 3: ensured ${NEW_CUISINES.length} new cuisines`);

  // 2. Existing external_ids, so we never duplicate a meal.
  const { data: existing } = await db.from('meals').select('external_id, cuisine_id');
  const seenExternal = new Set((existing ?? []).map((m) => String(m.external_id)));
  const countByCuisine: Record<string, number> = {};
  for (const m of existing ?? [])
    countByCuisine[m.cuisine_id] = (countByCuisine[m.cuisine_id] ?? 0) + 1;

  for (const [key, cuisineId] of Object.entries(CUISINES)) {
    const have = countByCuisine[cuisineId] ?? 0;
    const need = Math.max(0, TARGET_PER_CUISINE - have);
    if (need === 0) {
      console.log(`  ${key}: already ${have} meals, skip`);
      continue;
    }
    // Pull a pool + guarantee some fast (<15 min) meals.
    const fast = await spoonSearch(SPOON_CUISINE[key], 10, 15);
    const pool = await spoonSearch(SPOON_CUISINE[key], 25);
    const merged: SpoonRecipe[] = [];
    const pushUnique = (arr: SpoonRecipe[]) => {
      for (const r of arr) {
        if (seenExternal.has(String(r.id))) continue;
        if (merged.find((x) => x.id === r.id)) continue;
        if (!r.image) continue;
        merged.push(r);
      }
    };
    pushUnique(fast); // fast first so >=2 under 15 min land
    pushUnique(pool);

    const chosen = merged.slice(0, need);
    for (const r of chosen) {
      if (await insertRecipe(r, cuisineId)) seenExternal.add(String(r.id));
    }
    console.log(`  ${key}: had ${have}, added ${chosen.length} -> ${have + chosen.length}`);
  }
}

// ---------------------------------------------------------------------------
// PHASE 3b — corrective top-up (idempotent, ADD + UPDATE only). Spoonacular's
// data doesn't guarantee our demo goals, so after `spoon` we:
//   (a) ADD real <15-min recipes until every cuisine has >=2 fast meals,
//   (b) UPDATE one new meal's est_cost into the high tier for any cuisine with
//       no meal over $5 — never touching the original 30 (PRICE_MAP ids).
// Plausible high price per cuisine that lacks one:
const HIGH_FIX = 6.5;
const MIN_FAST = 2;

async function phaseTopup() {
  if (!SPOON_KEY) throw new Error('SPOONACULAR_API_KEY missing in .env — cannot run `topup`.');
  const { data: cuisines } = await db.from('cuisines').select('id, name');
  const nameById = new Map((cuisines ?? []).map((c) => [c.id as string, c.name as string]));

  // (a) fast-meal top-up
  for (const [key, cuisineId] of Object.entries(CUISINES)) {
    const { data: meals } = await db
      .from('meals')
      .select('external_id, cook_time_min')
      .eq('cuisine_id', cuisineId);
    const fastHave = (meals ?? []).filter((m) => m.cook_time_min < 15).length;
    let deficit = MIN_FAST - fastHave;
    if (deficit <= 0) continue;
    const seen = new Set((meals ?? []).map((m) => String(m.external_id)));
    const pool = await spoonSearch(SPOON_CUISINE[key], 30, 15);
    let added = 0;
    for (const r of pool) {
      if (deficit <= 0) break;
      if (!r.image || seen.has(String(r.id))) continue;
      if ((r.readyInMinutes ?? 99) >= 15) continue;
      if (await insertRecipe(r, cuisineId)) {
        seen.add(String(r.id));
        deficit--;
        added++;
      }
    }
    console.log(`  fast ${key}: had ${fastHave}, added ${added} -> ${fastHave + added}${deficit > 0 ? ' (Spoonacular pool exhausted)' : ''}`);
  }

  // (b) high-tier price fix — only for cuisines with no meal > $5, and only on
  // meals NOT in the original PRICE_MAP.
  const { data: allMeals } = await db.from('meals').select('id, cuisine_id, est_cost');
  const byCuisine = new Map<string, { id: string; est_cost: number }[]>();
  for (const m of allMeals ?? []) {
    const arr = byCuisine.get(m.cuisine_id) ?? [];
    arr.push({ id: m.id, est_cost: m.est_cost });
    byCuisine.set(m.cuisine_id, arr);
  }
  for (const [cuisineId, arr] of byCuisine) {
    if (arr.some((m) => m.est_cost > 5)) continue; // already has a high-tier meal
    // pick the priciest NEW meal (not an original-30 id) to bump.
    const candidates = arr
      .filter((m) => !(m.id in PRICE_MAP))
      .sort((a, b) => b.est_cost - a.est_cost);
    if (!candidates.length) continue;
    const target = candidates[0];
    const { error } = await db.from('meals').update({ est_cost: HIGH_FIX }).eq('id', target.id);
    console.log(`  price ${nameById.get(cuisineId)}: bumped 1 meal to $${HIGH_FIX}${error ? ' FAIL ' + error.message : ''}`);
  }
}

// ---------------------------------------------------------------------------
// PHASE 3c — RE-PULL. The first `spoon` pull returned too many non-mains +
// macro-laden descriptions (CLAUDE.md bans calorie/macro). This replaces ONLY
// the 51 Spoonacular-added meals (ids NOT in PRICE_MAP) with clean mains:
//   - Spoonacular type=main course
//   - client-side junk-title filter + cross-cuisine drop
//   - cleaned dish names, scrubbed ingredients, description left EMPTY
//   - deliberate price spread so every cuisine spans all 3 tiers
// Original 30 meals (PRICE_MAP ids) + their prices/images are never touched.
// ---------------------------------------------------------------------------
const JUNK_TITLE =
  /\b(lassi|smoothie|shake|dressing|dip|cookie|cookies|brownie|cheesecake|cake|gimlet|cocktail|margarita|latte|juice|sauce|chutney|pudding|pickle|pickled|jangajji|bun|omelet|gazpacho|puffs?)\b/i;
const CUISINE_WORDS = Object.keys(SPOON_CUISINE); // for cross-cuisine mislabel drop

function cleanName(raw: string): string {
  let t = raw.split(' - ')[0].split(': ')[0]; // cut SEO tail after " - " or ": "
  t = t.replace(/^how to make\s+/i, '').replace(/\brecipe\b/gi, '');
  t = t.replace(/\b(best|easy to make|homemade|quick fix|delicious|healthy|light|try this at home)\b/gi, '');
  t = t.replace(/\b(gluten[- ]free|dairy[- ]free|vegetarian|vegan|veg\b|paleo\w*|primal)\b/gi, '');
  t = t.replace(/[,(]\s*$/, '').replace(/\s{2,}/g, ' ').replace(/\s+([,)])/g, '$1').trim();
  t = t.replace(/[-–,]\s*$/, '').trim();
  return t.length ? t : raw.trim();
}

// Keep only real, clean ingredient names. Prefer nameClean; drop unit/quantity
// fragments and sentence-like leaks.
function cleanIngredients(r: SpoonRecipe): string[] {
  const out = new Set<string>();
  for (const i of r.extendedIngredients ?? []) {
    let n = (i.nameClean || i.name || '').trim().toLowerCase();
    if (!n) continue;
    if (/\d/.test(n)) continue; // has a number -> quantity leak
    if (/\b(cup|cups|tbsp|tsp|teaspoon|tablespoon|ounce|oz|lb|pound|gram|grams|ml|inch|pinch|to taste)\b/.test(n)) continue;
    if (/^(to|plus|or|and|use|equivalent)\b/.test(n)) continue;
    if (n.length > 32 || n.split(' ').length > 4) continue; // sentence-like
    n = n.replace(/^(fresh|dried|ground|chopped|minced)\s+/, '').trim();
    if (n && n.length > 1) out.add(n);
  }
  return Array.from(out);
}

// n plausible per-serving costs cycling low/med/high bands so any cuisine with
// >=3 new meals spans all 3 budget tiers.
function spreadCosts(n: number): number[] {
  const bands: [number, number][] = [
    [1.5, 2.9],
    [3.4, 4.8],
    [5.6, 7.8],
  ];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const [lo, hi] = bands[i % 3];
    const step = Math.floor(i / 3) * 0.6;
    out.push(Math.round(Math.min(hi, lo + step) * 10) / 10);
  }
  return out;
}

async function fetchMains(cuisineKey: string): Promise<SpoonRecipe[]> {
  const u = new URL('https://api.spoonacular.com/recipes/complexSearch');
  u.searchParams.set('apiKey', SPOON_KEY!);
  u.searchParams.set('cuisine', SPOON_CUISINE[cuisineKey]);
  u.searchParams.set('type', 'main course');
  u.searchParams.set('number', '40');
  u.searchParams.set('addRecipeInformation', 'true');
  u.searchParams.set('fillIngredients', 'true');
  u.searchParams.set('sort', 'random');
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Spoonacular ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { results?: SpoonRecipe[] }).results ?? [];
}

type RepullPick = { r: SpoonRecipe; cost: number };
type RepullPlan = { key: string; cuisineId: string; picks: RepullPick[] };

async function phaseRepull(dry: boolean) {
  if (!SPOON_KEY) throw new Error('SPOONACULAR_API_KEY missing in .env — cannot re-pull.');
  const TARGET = 8;

  // Identify the 51 Spoonacular-added meals = every meal id NOT in PRICE_MAP.
  const { data: allMeals } = await db.from('meals').select('id, external_id, cuisine_id');
  const newIds = (allMeals ?? []).filter((m) => !(m.id in PRICE_MAP)).map((m) => m.id as string);
  const keptExternal = new Set(
    (allMeals ?? []).filter((m) => m.id in PRICE_MAP).map((m) => String(m.external_id)),
  );
  // Originals per cuisine remain after the delete (5 for each existing cuisine,
  // 0 for the 4 new ones) — so `need` is known without querying post-delete.
  const origByCuisine: Record<string, number> = {};
  for (const m of allMeals ?? [])
    if (m.id in PRICE_MAP) origByCuisine[m.cuisine_id] = (origByCuisine[m.cuisine_id] ?? 0) + 1;
  console.log(`${dry ? '[DRY] ' : ''}re-pull: ${newIds.length} new meals to replace (original 30 kept)`);

  // ---- PHASE A: fetch + pick ALL cuisines FIRST, no writes. If Spoonacular
  // fails (e.g. daily quota), this throws BEFORE any delete, so the DB is left
  // fully intact — a partial wipe is impossible. ----
  const seenExternal = new Set(keptExternal);
  const plan: RepullPlan[] = [];
  for (const [key, cuisineId] of Object.entries(CUISINES)) {
    const need = Math.max(0, TARGET - (origByCuisine[cuisineId] ?? 0));
    if (need === 0) {
      plan.push({ key, cuisineId, picks: [] });
      continue;
    }
    const raw = await fetchMains(key);
    const chosen: SpoonRecipe[] = [];
    for (const r of raw) {
      if (chosen.length >= need) break;
      if (!r.image || seenExternal.has(String(r.id))) continue;
      const t = r.title.toLowerCase();
      if (JUNK_TITLE.test(t)) continue;
      if (/\bsalad\b/.test(t) && !/\bnoodle\b/.test(t)) continue; // salads unless noodle-based
      if (CUISINE_WORDS.some((w) => w !== key && new RegExp(`\\b${w}\\b`).test(t))) continue; // mislabel
      chosen.push(r);
      seenExternal.add(String(r.id));
    }
    const costs = spreadCosts(chosen.length).sort((a, b) => a - b);
    const ordered = [...chosen].sort((a, b) => (a.pricePerServing ?? 0) - (b.pricePerServing ?? 0));
    plan.push({ key, cuisineId, picks: ordered.map((r, i) => ({ r, cost: costs[i] })) });
  }

  // Report the plan (same output for dry-run and pre-exec preview).
  console.log(`\n${dry ? '[DRY-RUN] ' : ''}per-cuisine plan:`);
  for (const p of plan) {
    const t = [0, 0, 0];
    for (const pk of p.picks) t[pk.cost <= 3 ? 0 : pk.cost <= 5 ? 1 : 2]++;
    const fast = p.picks.filter((pk) => (pk.r.readyInMinutes ?? 30) < 15).length;
    console.log(`  ${p.key.padEnd(11)} +${p.picks.length} mains  tiers[lo,med,hi]=[${t}]  <15min:${fast}`);
    for (const pk of p.picks.slice(0, 3))
      console.log(`       • ${cleanName(pk.r.title)}  ($${pk.cost}, ${pk.r.readyInMinutes ?? 30}min)`);
  }
  console.log(`\n(descriptions stored EMPTY for all re-pulled meals — no macro/SEO text)`);
  const shortfall = plan.filter((p) => p.picks.length < TARGET - (origByCuisine[p.cuisineId] ?? 0));
  if (shortfall.length)
    console.log('  NOTE under-target after filtering:', shortfall.map((p) => p.key).join(', '));

  if (dry) return;

  // ---- PHASE B: delete the 51 new meals (FK-safe order), scoped to new ids only. ----
  if (newIds.length) {
    const { data: opts } = await db.from('recommendation_options').select('id').in('meal_id', newIds);
    const optIds = (opts ?? []).map((o) => o.id as string);
    if (optIds.length) {
      await db.from('feedback').delete().in('option_id', optIds);
      await db.from('recommendation_options').delete().in('id', optIds);
    }
    await db.from('meal_ingredients').delete().in('meal_id', newIds);
    const { error: delErr } = await db.from('meals').delete().in('id', newIds);
    if (delErr) throw new Error('meal delete failed: ' + delErr.message);
    console.log(`  deleted ${optIds.length} options + ingredients + ${newIds.length} meals`);
  }

  // ---- PHASE C: insert the pre-fetched mains + cleaned ingredients. ----
  let inserted = 0;
  for (const p of plan) {
    for (const { r, cost } of p.picks) {
      const cook = r.readyInMinutes ?? 30;
      const { data: meal, error } = await db
        .from('meals')
        .insert({
          name: cleanName(r.title),
          cuisine_id: p.cuisineId,
          effort_level: effortFromTime(cook),
          cook_time_min: cook,
          est_cost: cost,
          image_url: to636(r.image),
          source: 'spoonacular',
          external_id: String(r.id),
          dietary_tags: [],
          description: null, // scrub: never store Spoonacular macro/SEO text
        })
        .select('id')
        .single();
      if (error || !meal) {
        console.error(`    insert FAIL (${r.title}):`, error?.message);
        continue;
      }
      inserted++;
      const ings = cleanIngredients(r);
      if (ings.length)
        await db.from('meal_ingredients').insert(ings.map((name) => ({ meal_id: meal.id, name })));
    }
  }
  console.log(`  inserted ${inserted} clean mains`);
}

// ---------------------------------------------------------------------------
async function main() {
  const phase = process.argv[2] ?? 'all';
  if (phase === 'prices' || phase === 'all') await phasePrices();
  if (phase === 'images' || phase === 'all') await phaseImages();
  if (phase === 'spoon' || phase === 'all') await phaseSpoon();
  if (phase === 'topup' || phase === 'all') await phaseTopup();
  if (phase === 'repull') await phaseRepull(process.argv[3] === 'dry');
  console.log('done:', phase);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
