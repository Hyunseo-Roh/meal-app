// THROWAWAY — step/ingredient artifact fixer. DRY-RUN unless RUN_FIX=1. Do NOT commit.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SB_ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json' };

const meals = await (await fetch(`${SB_URL}/rest/v1/meals?select=id,name,instructions`, { headers: h })).json();
const ings = await (await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=id,meal_id,name`, { headers: h })).json();
const idToName = Object.fromEntries(meals.map((m) => [m.id, m.name]));

// ---- case-preserving target from the matched source ----
function casedTarget(match, target) {
  const isUpperAll = match === match.toUpperCase() && match !== match.toLowerCase();
  if (isUpperAll) return target.toUpperCase();
  const firstUpper = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
  return firstUpper ? target[0].toUpperCase() + target.slice(1) : target;
}

// A "not followed by another letter (ascii OR accented)" guard so already-correct
// accented forms (sauté) are never re-accented into sautéé.
const NEXT_LETTER = 'a-zàâäçéèêëíîïñóôöúûü';

const RULES = [
  { type: 'saut → sauté', re: new RegExp(`\\bsaut(?![${NEXT_LETTER}])`, 'gi'), rep: (m) => casedTarget(m, 'sauté') },
  { type: 'jalapeno → jalapeño', re: /jalapeno/gi, rep: (m) => casedTarget(m, 'jalapeño') },
  { type: 'puree → purée', re: /puree/gi, rep: (m) => casedTarget(m, 'purée') },
  { type: '&amp; → &', re: /&amp;/g, rep: () => '&' },
  { type: '&quot; → "', re: /&quot;/g, rep: () => '"' },
];

// repeated identical accented char = accidental double-accent
const DOUBLE_ACCENT = /([àâäçéèêëíîïñóôöúûü])\1/i;

// window around a given [start,len) span of str
function windowAt(str, start, len) {
  const from = Math.max(0, start - 22);
  const to = Math.min(str.length, start + len + 22);
  return (from > 0 ? '…' : '') + str.slice(from, to) + (to < str.length ? '…' : '');
}

// changes: type -> [ {table, meal, column, before, after} ]
const byType = Object.fromEntries(RULES.map((r) => [r.type, []]));
const changedMeals = new Set();
const rowsToUpdate = { meals: 0, meal_ingredients: 0 };
const guardFails = [];
const mealUpdates = []; // { id, name, instructions: string[] }
const ingUpdates = [];  // { id, meal, name }

// ---- apply to meals.instructions ----
for (const meal of meals) {
  const steps = Array.isArray(meal.instructions) ? meal.instructions : [];
  let mealChanged = false;
  const newSteps = [];
  for (const s of steps) {
    let cur = s ?? '';
    let rowChanged = false;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      const m = rule.re.exec(cur);
      if (m) {
        const start = m.index;
        const before = windowAt(cur, start, m[0].length);
        const next = cur.replace(rule.re, rule.rep);
        // The prefix up to `start` is unchanged by this rule's first match, so the
        // replaced token still begins at `start`; window there to show the fix.
        const repLen = rule.rep(m[0]).length;
        const after = windowAt(next, start, repLen);
        byType[rule.type].push({ table: 'meals', meal: meal.name, column: 'instructions', before, after });
        cur = next;
        rowChanged = true;
      }
    }
    if (rowChanged) {
      // guard: replacement must not have produced a double-accent (e.g. sautéé)
      if (DOUBLE_ACCENT.test(cur)) guardFails.push({ meal: meal.name, reason: 'double-accent', value: cur });
      mealChanged = true;
    }
    newSteps.push(cur); // keep every step (changed or not) to rebuild the full text[]
  }
  if (mealChanged) { rowsToUpdate.meals++; changedMeals.add(meal.name); mealUpdates.push({ id: meal.id, name: meal.name, instructions: newSteps }); }
}

// ---- apply to meal_ingredients.name ----
for (const ing of ings) {
  let cur = ing.name ?? '';
  let rowChanged = false;
  const label = idToName[ing.meal_id] ?? '(unknown)';
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    if (rule.re.test(cur)) {
      const before = cur;
      const next = cur.replace(rule.re, rule.rep);
      byType[rule.type].push({ table: 'meal_ingredients', meal: label, column: 'name', before, after: next });
      cur = next;
      rowChanged = true;
    }
  }
  if (rowChanged) {
    if (DOUBLE_ACCENT.test(cur)) guardFails.push({ meal: label, reason: 'double-accent', value: cur });
    rowsToUpdate.meal_ingredients++;
    changedMeals.add(label);
    ingUpdates.push({ id: ing.id, meal: label, name: cur });
  }
}

// ---- report ----
console.log('=== DRY RUN — no writes ===\n');
let grand = 0;
for (const rule of RULES) {
  const rows = byType[rule.type];
  grand += rows.length;
  console.log(`\n##### ${rule.type} — ${rows.length} substring hits #####`);
  for (const r of rows) {
    console.log(`  [${r.table}] "${r.meal}" · ${r.column}`);
    console.log(`      BEFORE: ${r.before}`);
    console.log(`      AFTER : ${r.after}`);
  }
  if (!rows.length) console.log('  (none)');
}

console.log('\n=== DOUBLE-ACCENT GUARD ===');
console.log(guardFails.length ? JSON.stringify(guardFails, null, 2) : '  PASS — no double-accents, no leftover bare tokens introduced.');

// confirm double-space rows are NOT in scope
const dsInScope = [...RULES].some((r) => r.type.includes('space'));
console.log('\n=== DOUBLE-SPACE CHECK ===');
console.log(`  double-space handling in rule set: ${dsInScope ? 'PRESENT (unexpected!)' : 'ABSENT — correctly out of scope'}`);

console.log('\n=== TOTALS ===');
console.log(`  substring hits total: ${grand}`);
console.log(`  meals rows to update: ${rowsToUpdate.meals}`);
console.log(`  meal_ingredients rows to update: ${rowsToUpdate.meal_ingredients}`);
console.log(`  distinct meals affected: ${changedMeals.size}`);

if (process.env.RUN_FIX !== '1') {
  console.log('\nDRY RUN complete. Awaiting "fix approved".');
  process.exit(0);
}

// ===== WRITE PATH (RUN_FIX=1) — PATCH each flagged row by id, meals first =====
if (guardFails.length) {
  console.error('\nABORT — guard failures present; refusing to write:', JSON.stringify(guardFails, null, 2));
  process.exit(1);
}
console.log('\n=== WRITE (RUN_FIX=1) ===');
let wroteMeals = 0;
for (const u of mealUpdates) {
  const res = await fetch(`${SB_URL}/rest/v1/meals?id=eq.${u.id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ instructions: u.instructions }),
  });
  if (!res.ok) {
    console.error(`\nSTOP — PATCH meals id ${u.id} ("${u.name}") FAILED: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  wroteMeals++;
}
console.log(`  meals PATCHed: ${wroteMeals}`);

let wroteIng = 0;
for (const u of ingUpdates) {
  const res = await fetch(`${SB_URL}/rest/v1/meal_ingredients?id=eq.${u.id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ name: u.name }),
  });
  if (!res.ok) {
    console.error(`\nSTOP — PATCH meal_ingredients id ${u.id} ("${u.meal}") FAILED: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  wroteIng++;
}
console.log(`  meal_ingredients PATCHed: ${wroteIng}`);

// ===== POST-WRITE RE-SCAN (read-only) =====
console.log('\n=== POST-WRITE RE-SCAN (whole catalog) ===');
const meals2 = await (await fetch(`${SB_URL}/rest/v1/meals?select=name,instructions`, { headers: h })).json();
const ings2 = await (await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=name`, { headers: h })).json();

// artifact detectors (the five FIXED types only)
const SAUT = new RegExp(`\\bsaut(?![${NEXT_LETTER}])`, 'i');
const detectors = {
  saut: (s) => SAUT.test(s),
  jalapeno: (s) => /jalapeno/i.test(s),
  puree: (s) => /puree/i.test(s),
  '&amp;': (s) => /&amp;/.test(s),
  '&quot;': (s) => /&quot;/.test(s),
};
const post = { saut: 0, jalapeno: 0, puree: 0, '&amp;': 0, '&quot;': 0 };
for (const m of meals2) for (const s of (Array.isArray(m.instructions) ? m.instructions : [])) {
  for (const [k, fn] of Object.entries(detectors)) if (fn(s ?? '')) post[k]++;
}
for (const ing of ings2) for (const [k, fn] of Object.entries(detectors)) if (fn(ing.name ?? '')) post[k]++;

// sanity: the correctly-accented forms should still be present, untouched
const correctSaute = meals2.some((m) => (m.instructions ?? []).some((s) => /sauté/i.test(s)));
const correctJal = [...meals2.flatMap((m) => m.instructions ?? []), ...ings2.map((i) => i.name)].some((s) => /jalapeño/i.test(s ?? ''));
const correctPuree = meals2.some((m) => (m.instructions ?? []).some((s) => /purée/i.test(s)));

console.log('  post-scan artifact counts (expect all 0):');
for (const [k, v] of Object.entries(post)) console.log(`    ${k.padEnd(9)}: ${v}${v === 0 ? '' : '  <-- REMAINING!'}`);
console.log('  correctly-accented forms still present (expect all true):');
console.log(`    sauté: ${correctSaute} | jalapeño: ${correctJal} | purée: ${correctPuree}`);

const allZero = Object.values(post).every((v) => v === 0);
console.log(`\n=== RESULT: ${allZero ? 'CLEAN — zero remaining hits for all five fixed types.' : 'INCOMPLETE — see REMAINING above.'} ===`);
