/**
 * Cooking-instruction backfill — resumable, quota-aware, ADD-ONLY.
 *
 *   node --experimental-strip-types scripts/instructions.ts --dry   # print the queue, ZERO API calls
 *   node --experimental-strip-types scripts/instructions.ts         # fetch + persist until the quota floor
 *
 * Why a separate script and not a seed.ts phase: seed.ts's phases are one-shot
 * and `phaseRepull` DELETES + re-inserts meals. This job only ever runs
 * `UPDATE meals SET instructions` on rows it just fetched — it can never touch a
 * name, price, ingredient, or FK. Keeping it out of seed.ts means `seed.ts all`
 * can never trigger it, and it can never trigger a repull.
 *
 * The 3 properties that matter, given ~50 Spoonacular points/day vs 70 meals:
 *
 *  1. RESUMABLE. The work queue IS the data: `.is('instructions', null)`. There
 *     is no cursor file or offset to corrupt. Re-running tomorrow selects exactly
 *     the rows still untouched. Day 2 needs no arguments and no code change.
 *
 *  2. QUOTA-AWARE. We trust the server's own counter (x-api-quota-left), not our
 *     arithmetic, and stop at a floor with margin. Also hard-stops on HTTP 402.
 *     complexSearch is never called here — only /information at exactly 1.0 pt
 *     (includeNutrition=false; no addWinePairing/addTasteData).
 *
 *  3. PERSIST-IMMEDIATELY. One UPDATE per meal, before the next fetch. Never
 *     batched at the end: a crash must never discard points already spent. Worst
 *     case we lose the single in-flight point.
 *
 * Empty steps are stored as '{}' (empty array), NOT NULL — a terminal state. The
 * queue filters on IS NULL, so a no-steps recipe is excluded forever instead of
 * burning a point on every future run. See the migration for the 3-state contract.
 *
 * Keys come from .env (gitignored) — never hardcode. Same vars as seed.ts.
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

/** Stop while this many points remain. Margin so we never spend the last point. */
const QUOTA_FLOOR = 3;

const DRY = process.argv.includes('--dry');

type MealRow = { id: string; name: string; external_id: string };

/** Spoonacular /information — only the shape we consume. */
type SpoonInfo = {
  analyzedInstructions?: { name?: string; steps?: { number?: number; step?: string }[] }[];
};

/** analyzedInstructions[].steps[].step -> ordered string[]. Flattens multi-block
 *  recipes (e.g. "For the sauce" / "For the assembly") into one list, preserving
 *  order. Blank/whitespace steps are dropped. */
function parseSteps(j: SpoonInfo): string[] {
  return (j.analyzedInstructions ?? [])
    .flatMap((block) => block.steps ?? [])
    .map((s) => String(s.step ?? '').trim())
    .filter(Boolean);
}

async function main() {
  // The queue. IS NULL only: '{}' rows are DONE and must never be re-fetched.
  const { data, error } = await db
    .from('meals')
    .select('id, name, external_id')
    .is('instructions', null)
    .order('name');
  if (error) throw new Error(`queue read failed: ${error.message}`);

  const todo = (data ?? []) as MealRow[];
  console.log(`queue: ${todo.length} meals with instructions IS NULL`);

  if (DRY) {
    console.log('\n--- DRY RUN — no API calls, no writes ---');
    todo.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.name}  (ext ${m.external_id})`));
    console.log(`\n${todo.length} meals would be fetched at 1.0 point each.`);
    return;
  }

  if (!SPOON_KEY) throw new Error('SPOONACULAR_API_KEY missing in .env — cannot fetch.');
  if (todo.length === 0) {
    console.log('nothing to do — every meal already has instructions or a {} sentinel.');
    return;
  }

  let fetched = 0;
  let withSteps = 0;
  let empty = 0;
  let failed = 0;
  let quotaLeft: number | null = null;

  for (const meal of todo) {
    const u = new URL(`https://api.spoonacular.com/recipes/${meal.external_id}/information`);
    u.searchParams.set('apiKey', SPOON_KEY);
    u.searchParams.set('includeNutrition', 'false'); // keep the call at exactly 1.0 pt

    let r: Response;
    try {
      r = await fetch(u);
    } catch (e) {
      console.error(`  ${meal.name}: network error — leaving NULL, will retry`, (e as Error).message);
      failed++;
      continue;
    }

    // Quota exhausted — stop immediately, resume tomorrow. Never keep hammering.
    if (r.status === 402) {
      console.log('\n402 Payment Required — daily quota exhausted. Stopping; re-run tomorrow.');
      break;
    }
    if (!r.ok) {
      console.error(`  ${meal.name}: HTTP ${r.status} — leaving NULL, will retry`);
      failed++;
      continue;
    }

    const steps = parseSteps((await r.json()) as SpoonInfo);
    fetched++;

    // PERSIST NOW — before the next fetch. [] is the terminal no-steps sentinel.
    const { error: upErr } = await db
      .from('meals')
      .update({ instructions: steps })
      .eq('id', meal.id);

    if (upErr) {
      // The point is already spent and the row stays NULL: it will be retried
      // tomorrow at the cost of 1 more point. Loud, because it is real waste.
      console.error(`  ${meal.name}: DB WRITE FAILED (point spent, stays NULL): ${upErr.message}`);
      failed++;
    } else if (steps.length === 0) {
      empty++;
      console.log(`  ${meal.name}: 0 steps -> {} (terminal, never retried)`);
    } else {
      withSteps++;
      console.log(`  ${meal.name}: ${steps.length} steps`);
    }

    // Trust the server's counter over our own arithmetic.
    const left = Number(r.headers.get('x-api-quota-left') ?? 'NaN');
    if (!Number.isNaN(left)) {
      quotaLeft = left;
      if (left < QUOTA_FLOOR) {
        console.log(`\nquota floor reached (x-api-quota-left ${left} < ${QUOTA_FLOOR}) — stopping cleanly.`);
        break;
      }
    }
  }

  const { count: remaining } = await db
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .is('instructions', null);

  console.log('\n===== RUN SUMMARY =====');
  console.log(`  fetched this run : ${fetched}`);
  console.log(`  with steps       : ${withSteps}`);
  console.log(`  empty ({})       : ${empty}`);
  console.log(`  failed (still NULL): ${failed}`);
  console.log(`  x-api-quota-left : ${quotaLeft ?? 'unknown'}`);
  console.log(`  STILL NULL (next run): ${remaining ?? '?'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
