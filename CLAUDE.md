# CLAUDE.md — Everyday Meal Decisions

Read this file fully before doing anything. It defines the hard constraints for this build. When in doubt, ask before changing anything in the "DO NOT TOUCH" sections.

## What this app is
A meal-decision app for young adults that reduces decision fatigue. Each session it recommends **exactly three** meals (Familiar / Adjacent / Stretch), explains why in one line each, lets the user swap, tracks what's in their pantry, and learns taste over time. The differentiator is **Pantry Memory + an Ingredient Gap Tracker** (for the chosen meal: what you have vs what to buy). No calorie tracking, no health lectures, **no runtime LLM** — recommendations come from a rule-based Postgres function.

## Tech stack
- Expo (React Native) + TypeScript + expo-router, Android-first.
- expo-camera for barcode scanning.
- Supabase (project ref `lsmsgtwhvqlawiqknaqg`). RLS is disabled, anon GRANT all (dev).
- Meals seeded from Spoonacular (seed time only). Pantry barcodes via Open Food Facts (runtime, keyless).
- Deploy publicly (Vercel / Netlify / Expo) so a stranger can open it.

## DO NOT TOUCH — database schema (already built and seeded)
8 tables, 4 enums. Do not alter columns, types, or enums. Read/write only.

- **users**: id, first_name, last_name, email, pref_effort(1–3), pref_budget, default_budget, default_effort, disliked_ingredients(text[]), dietary_tags(text[]), created_at, last_active, updated_at, pref_cuisine_id(FK→cuisines), disliked_cuisine_ids(uuid[])
- **cuisines**: id, name(unique), display_label, emoji
- **meals**: id, name, cuisine_id(FK), effort_level(1–3), cook_time_min, est_cost, image_url, source, external_id(unique), dietary_tags(text[]), description
- **meal_ingredients**: id, meal_id(FK), name
- **recommendation_requests**: id, user_id(FK), mood, energy, budget, time_available, ingredients_on_hand(text[]), created_at, context_source, inferred_mood
- **recommendation_options**: id, request_id(FK), meal_id(FK), tier(tier_type), explanation, was_selected(bool), tier_order
- **feedback**: id, user_id(FK), request_id(FK), option_id(FK), rating(rating_type), reason(reason_type), created_at
- **pantry_items**: id, user_id(FK), name, barcode, product_name, source('scanned'|'manual'), created_at, updated_at

Enums: budget_level(low/medium/high) · tier_type(familiar/adjacent/stretch) · rating_type(loved_it/fine/not_for_me) · reason_type(too_much_effort/wrong_mood/wrong_ingredient/too_expensive)

Cuisine ids: italian `a0000000-...-001` 🍝 · mexican 002 🌮 · thai 003 🍜 · american 004 🍔 · japanese 005 🍱 · korean 006 🥩

## DO NOT TOUCH — backend functions (already built)
- `recommend_meals(p_user_id uuid, p_time_available int default null, p_budget budget_level default null, p_mood text default null)` → returns a table of (tier, meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, over_time, score). **Always returns exactly 3 rows.** Score = effort30 + cuisine30 + budget20 + feedback±20 + pantry+15. Time is a soft signal (ranking + `over_time` flag), not a hard filter. Only hard filter is disliked cuisine. Cold start: NULL prefs coalesce to effort 2 / budget medium / cuisine bonus 0 / disliked '{}'.
- `get_ingredient_gap(user, meal)` → have vs missing, normalized substring match.

Call these RPCs as-is. Do not reimplement recommendation logic in the client. Do not add an LLM call anywhere.

## Design system — enforce exactly
**Colors (only these):** Bone `#EDEAE3` (bg) · Greige `#DCD3C5` (cards) · Warm Gray `#C9C2B6` (borders) · Warm Gray Deep `#A7A8A3` (muted text) · Cool Slate `#8A9AA6` (selection accent: chips, feedback pills, active nav) · Charcoal Ink `#2E2E2C` (text & primary action buttons; never pure black) · **Sage `#7C8A6B` (semantic "have/success" ONLY — the ✓ checks in the Gap Tracker; nowhere else).** No other colors.

**Type — locked 4-step ladder, no in-between sizes:** Screen Title 32/38 Semibold · Section Title 24/30 Medium · Body 16/24 Regular · Label 13/16 Medium UPPERCASE +6%. Never use 18, 20, or 15. Hierarchy comes from size + color, not from bolding everything.

**Layout:** 390px content width baseline, 24px side margins, 4px spacing grid. Vertical scroll only; never fill empty space with a color block. No phone device frame in UI.

**Voice:** "Tonight: three options." · "Picked for you — here's why." · "Handled." · "Your taste." Calm, spare, never cute.

**Components:** chips (pill; selected = Cool Slate fill) · cards (Greige, 12–16px radius, flat) · primary button (Charcoal Ink, 52px) · ghost button (1px border) · bottom nav 3 tabs (Home · History · Taste), hidden during onboarding.

## Hard product rules (do not violate)
- **Exactly three recommendations.** Never 2, never 4+. No "see more" / infinite list on the recommendation screen.
- **No runtime LLM.** Rule-based RPC only.
- **No calorie / macro / health / tracking UI** anywhere.
- **No dietary-restriction management UI** (Won't-have). disliked_ingredients (taste) is fine; dietary management is not.
- **Every user input must map to a real DB column.** Never collect data the schema can't store. (No "who's eating", no quantities/expiry on pantry.)
- **Onboarding collects only:** pref_cuisine_id, disliked_cuisine_ids (the only hard filter), disliked_ingredients, pref_effort, default_budget. Favorite cuisine and skip cuisines are mutually exclusive.
- **Mood is per-session** (recommendation_requests.mood), optional/skippable — not an onboarding field.
- **Feedback** is asked at the start of the next session (returning-user card). reason chips show ONLY for "Not for me". The Handled screen collects no feedback.
- **Consistency:** a meal's cook_time_min is the same on every screen (e.g. Miso Butter Udon = 20 min). Every cooking ingredient appears in the Gap Tracker's have or to-buy list so counts add up.
- **Admin** is a separate entry point, never in the user bottom nav.
- Auth: anonymous Supabase session created silently on first run (no login wall). Account upgrade is optional/secondary.

## Build order (do this in sequence)
**Phase 1 — Critical path, end-to-end with real Supabase data (the demo):**
0. Scaffold Expo + Supabase client. Set up design tokens (colors above) and the 4-step type scale FIRST, as shared constants.
1. **Screen 3 — How's Tonight:** time (required) + optional mood + "use what I have" toggle + optional budget. Write a row to `recommendation_requests`.
2. **Screen 4 — Three Options:** call `recommend_meals(...)`, render exactly 3 tier cards (Familiar/Adjacent/Stretch), show `over_time` as a calm caption when true.
3. **Screen 5 — Why We Chose This:** show `recommendation_options.explanation` as four one-line reasons.
4. **Screen 7 — Meal Detail + Gap:** call `get_ingredient_gap(...)`, render have (Sage ✓) vs to-buy, plus short steps. cook_time_min from the meal row.
5. **Screen 8 — Handled:** set `was_selected = true` on the chosen option; near-empty payoff screen.
→ Phase 1 is the working demo. Deploy it publicly before moving on.

**Phase 2 — the rest:**
6. Screen 1 (Taste Setup) + Screen 2 (Pantry Setup) with the anonymous session; seed user profile + pantry_items.
7. Screen 6 (Swap), Screen 9 (Your Taste), Screen 3b (returning-session Feedback → `feedback`).
8. Screen 2b/2c (scan + scan-fail), empty/error states (not-enough-recs, loading, offline).
9. Admin (Meal Catalog list + edit), if time allows.

**Before public deploy:** replace the `lookupBarcode.ts` USER_AGENT `contact@example.com` with a real email.

## Working style
- One thing at a time. Before changing anything in a DO NOT TOUCH section, stop and confirm it's actually necessary.
- Match the Figma screens; the design is already finalized.
- Document as you go (prompts used, what worked, what didn't, surprises, open questions) for the FigJam process log.
