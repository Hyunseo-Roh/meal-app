-- Clean recipe steps, pass 2 — the residue the first pass (20260724_clean_
-- recipe_steps.sql) left behind. Data only — no schema, RPC, app code, or
-- meal_ingredients. We do NOT author replacement steps for any meal; this only
-- deletes non-instruction content. Deletes are non-contiguous for Chicken
-- Fajita, so the array is rebuilt from the kept steps (no interior gaps).
--
-- ============================================================================
-- RECOVERABLE BEFORE-STATE (meal — step number — original text), captured
-- 2026-07-24 immediately before the UPDATEs below:
-- ============================================================================
--
-- Chicken Fajita Stuffed Bell Pepper (10 steps) — DELETE steps 6, 8, 9, 10;
-- keep 1-5 and 7. Step 6 is the recipe TITLE scraped in as a step; 8-10 are
-- author commentary / blog promo:
--   6.  Chicken Fajita Stuffed Bell Pepper
--   8.  This is SO GOOD! I love bell peppers, and I love all of these flavors
--       that are married together that make this chicken fajita stuffed bell
--       pepper so amazing. I could seriously just eat the flavored quinoa all by
--       itself.
--   9.  If you are looking for even more delicious and healthy recipes, make
--       sure you head over to the Simple Fit Forty tab under the cooking section
--       of this blog.  We have all of our favorite healthy recipes listed for
--       you right there in one spot. You can also drool over out latest on the
--       Simple Fit Forty Instagram page.
--   10. If you are looking to get healthy and fit, come and join the super
--       secret and awesome Simple Fit Forty Lifestyle community over on
--       Facebook.  We would love to have you join!
--   (kept 1-5 unchanged, and step 7 "Top with avocado and serve with shredded
--    lettuce and salsa for a complete meal." becomes the new final step 6)
--
-- Garlic Lemon Chili Broccoli (1 step) — DELETE its only step (not an
-- instruction); leaves [] (0 steps):
--   1. Whatch video
-- ============================================================================

update meals set instructions = ARRAY[$s$To get started heat oven to 35$s$, $s$Mix salt, pepper, cilantro, cumin, chili powder, and quinoa together and place to the side.$s$, $s$Cut the bell pepper in half (if you havent already) and clean out the seeds.$s$, $s$Layer quinoa and then grilled chicken into the pepper, and then top each with cheese.$s$, $s$Place in the oven for about 10 minutes until the bell pepper has softened.$s$, $s$Top with avocado and serve with shredded lettuce and salsa for a complete meal.$s$]::text[] where name = $n$Chicken Fajita Stuffed Bell Pepper$n$;

update meals set instructions = ARRAY[]::text[] where name = $n$Garlic Lemon Chili Broccoli$n$;
