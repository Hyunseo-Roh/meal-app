// THROWAWAY — Lever 1 insert builder. DRY-RUN by default. Do NOT commit.
// Writes only when RUN_INSERT=1 AND after explicit approval.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SB_ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const sbHeaders = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json' };

const detail = JSON.parse(readFileSync(new URL('./_lever1_detail.json', import.meta.url), 'utf8'));

// bucket assignment (matches locked ids from run 1; 638369 reassigned Chinese -> Korean)
const BUCKET = {
  american: [632874, 991010, 649141],
  mexican: [986003, 1063645, 982382],
  indian: [637264, 642941, 1096180, 1096306, 650484, 650378],
  italian: [650119, 664565],
  greek: [716408, 1098350, 645384, 645315],
  korean: [638369], // reassigned off Chinese by title
};
const CUISINE_ID = {
  american: 'a0000000-0000-0000-0000-000000000004',
  mexican: 'a0000000-0000-0000-0000-000000000002',
  indian: 'a0000000-0000-0000-0000-000000000009',
  italian: 'a0000000-0000-0000-0000-000000000001',
  greek: 'a0000000-0000-0000-0000-000000000010',
  korean: 'a0000000-0000-0000-0000-000000000006',
};
const idToBucket = {};
for (const [b, ids] of Object.entries(BUCKET)) for (const id of ids) idToBucket[id] = b;

const norm = (s) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

function effortFromSteps(total) {
  if (total <= 4) return 1;
  if (total <= 8) return 2;
  return 3;
}
function stepStrings(r) {
  const out = [];
  for (const block of r.analyzedInstructions ?? []) {
    for (const st of block.steps ?? []) {
      if (st.step && st.step.trim()) out.push(st.step.trim());
    }
  }
  return out;
}
function dietaryTags(r) {
  const t = [];
  if (r.vegetarian) t.push('vegetarian');
  if (r.vegan) t.push('vegan');
  if (r.glutenFree) t.push('gluten free');
  if (r.dairyFree) t.push('dairy free');
  return t;
}

const built = detail.map((r) => {
  const bucket = idToBucket[r.id];
  const steps = stepStrings(r);
  const price = r.pricePerServing;
  const est_cost = (typeof price === 'number' && !Number.isNaN(price)) ? Math.round((price / 100) * 100) / 100 : null;
  // ingredients: lowercase/trim/collapse, dedup within recipe
  const ingSeen = new Set();
  const ingredients = [];
  for (const ing of r.extendedIngredients ?? []) {
    const n = norm(ing.name);
    if (n && !ingSeen.has(n)) { ingSeen.add(n); ingredients.push(n); }
  }
  return {
    external_id: r.id,
    bucket,
    meal: {
      name: r.title,
      external_id: r.id,
      source: 'spoonacular',
      cook_time_min: r.readyInMinutes,
      image_url: r.image,
      est_cost,
      description: null,
      dietary_tags: dietaryTags(r),
      effort_level: effortFromSteps(steps.length),
      cuisine_id: CUISINE_ID[bucket],
      instructions: steps, // text[] to match existing rows
    },
    ingredients,
    _stepCount: steps.length,
  };
});

// idempotency guard
const exRes = await fetch(`${SB_URL}/rest/v1/meals?select=external_id`, { headers: sbHeaders });
const existing = new Set((await exRes.json()).map((r) => String(r.external_id)));
const toInsert = built.filter((b) => !existing.has(String(b.external_id)));
const skipped = built.filter((b) => existing.has(String(b.external_id)));

const DO_WRITE = process.env.RUN_INSERT === '1';

if (!DO_WRITE) {
  console.log('=== DRY RUN — no writes ===\n');
  console.log(`existing external_ids in catalog: ${existing.size} | would insert: ${toInsert.length} | skip (already present): ${skipped.length}`);
  if (skipped.length) console.log('  skipped ids: ' + skipped.map((b) => b.external_id).join(', '));
  console.log('');
  console.log('name | bucket | cook_min | est_cost | effort | dietary_tags | #ing');
  console.log('-----|--------|----------|----------|--------|--------------|-----');
  for (const b of built) {
    const m = b.meal;
    console.log([
      m.name.slice(0, 48),
      b.bucket,
      m.cook_time_min,
      m.est_cost,
      m.effort_level,
      '[' + m.dietary_tags.join(',') + ']',
      b.ingredients.length,
    ].join(' | '));
  }

  const sample = built[0];
  console.log(`\n----- sample instructions value (row: ${sample.meal.name}) — column type text[] -----`);
  console.log(JSON.stringify(sample.meal.instructions, null, 2));
  console.log(`  sample ingredients (${sample.ingredients.length}): ${JSON.stringify(sample.ingredients)}`);

  const dist = { 1: 0, 2: 0, 3: 0 };
  for (const b of built) dist[b.meal.effort_level]++;
  console.log(`\neffort_level distribution: 1 -> ${dist[1]}, 2 -> ${dist[2]}, 3 -> ${dist[3]}`);

  const badCost = built.filter((b) => b.meal.est_cost == null || Number.isNaN(b.meal.est_cost));
  const badEffort = built.filter((b) => b._stepCount === 0);
  console.log(`\nrows with null/NaN est_cost: ${badCost.length ? badCost.map((b) => b.external_id).join(', ') : 'none'}`);
  console.log(`rows with 0 steps (effort fallback): ${badEffort.length ? badEffort.map((b) => b.external_id).join(', ') : 'none'}`);
  console.log('\nDRY RUN complete. Awaiting "insert approved".');
  process.exit(0);
}

// ===== WRITE PATH (only with RUN_INSERT=1) =====
console.log('=== INSERT (RUN_INSERT=1) ===');
if (!toInsert.length) { console.log('nothing to insert (all present).'); process.exit(0); }

const insertedIds = [];
for (const b of toInsert) {
  // 1. insert the single meals row, RETURNING id/external_id/name
  const mRes = await fetch(`${SB_URL}/rest/v1/meals`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(b.meal),
  });
  if (!mRes.ok) {
    console.error(`\nSTOP — meals insert FAILED for "${b.meal.name}" (external_id ${b.external_id})`);
    console.error(`  HTTP ${mRes.status}: ${await mRes.text()}`);
    process.exit(1);
  }
  const [row] = await mRes.json();
  const mealId = row.id;
  insertedIds.push(b.external_id);

  // 2. immediately insert this meal's children
  if (b.ingredients.length) {
    const ingPayload = b.ingredients.map((name) => ({ meal_id: mealId, name }));
    const iRes = await fetch(`${SB_URL}/rest/v1/meal_ingredients`, {
      method: 'POST', headers: sbHeaders, body: JSON.stringify(ingPayload),
    });
    if (!iRes.ok) {
      console.error(`\nSTOP — meal_ingredients insert FAILED for "${b.meal.name}" (meal_id ${mealId})`);
      console.error(`  HTTP ${iRes.status}: ${await iRes.text()}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ ${row.name} (ext ${b.external_id}) + ${b.ingredients.length} ingredients`);
}
console.log(`\nINSERT complete: ${insertedIds.length} meals + children written.`);

// ===== POST-INSERT VERIFICATION (read-only) =====
console.log('\n=== VERIFICATION ===');
const cRes = await fetch(`${SB_URL}/rest/v1/meals?select=count`, { headers: { ...sbHeaders, Prefer: 'count=exact' } });
const cBody = await cRes.json();
console.log(`meals count now: ${JSON.stringify(cBody)} (expected 87; was 70)`);

const idList = toInsert.map((b) => b.external_id).join(',');
const rbRes = await fetch(`${SB_URL}/rest/v1/meals?select=name,external_id,cuisine_id,effort_level,est_cost,cook_time_min&external_id=in.(${idList})`, { headers: sbHeaders });
const rb = await rbRes.json();
console.log(`\n17-row readback (${rb.length} rows):`);
console.log('name | cuisine_id(last3) | effort | est_cost | cook_min');
const cuisNames = {
  '004': 'american', '002': 'mexican', '009': 'indian', '001': 'italian', '010': 'greek', '006': 'korean',
};
for (const r of rb) {
  const suf = r.cuisine_id.slice(-3);
  console.log(`  ${r.name.slice(0, 46)} | ${suf}(${cuisNames[suf] ?? '?'}) | ${r.effort_level} | ${r.est_cost} | ${r.cook_time_min}`);
}

// per-cuisine new count
const perC = {};
for (const r of rb) { const suf = r.cuisine_id.slice(-3); perC[cuisNames[suf] ?? suf] = (perC[cuisNames[suf] ?? suf] ?? 0) + 1; }
console.log('\nper-cuisine new-count: ' + Object.entries(perC).map(([k, v]) => `${k}:${v}`).join(', '));

// 3 ingredient spot-checks: one american (632874), korean (638369), one indian (637264)
const spotIds = [632874, 638369, 637264];
console.log('\ningredient spot-checks:');
for (const extId of spotIds) {
  const mr = await fetch(`${SB_URL}/rest/v1/meals?select=id,name&external_id=eq.${extId}`, { headers: sbHeaders });
  const [m] = await mr.json();
  const ir = await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=name&meal_id=eq.${m.id}`, { headers: sbHeaders });
  const ings = (await ir.json()).map((x) => x.name);
  console.log(`  ${m.name} (ext ${extId}): [${ings.join(', ')}]`);
}
console.log('\nVERIFICATION complete.');
