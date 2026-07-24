-- Clean non-instruction cooking steps out of meals.instructions (text[]).
--
-- A scan of all 70 meals found scraped share buttons, a reader question, an
-- author sign-off, a blog link, and a nutrition note glued onto a real step.
-- Three buckets were agreed: DELETE (not an instruction), TRIM (real step with
-- junk tail — keep the step, cut the tail), KEEP (terse-but-legit "Serve." /
-- "Enjoy!", untouched). This migration applies the DELETE + TRIM buckets.
-- Data only — no schema, RPC, app code, or meal_ingredients changes. Deletes
-- here are all trailing, so rebuilding each array leaves no interior gaps.
--
-- KNOWN-INCOMPLETE (flagged, deliberately out of this migration's agreed scope):
-- after removing its six share-button steps, "Chicken Fajita Stuffed Bell
-- Pepper" still carries non-instruction content the agreed buckets did not
-- cover — step 6 is the recipe TITLE scraped in as a step, and steps 8-10 are
-- author commentary / blog promo. A follow-up pass is needed to make it read
-- end-to-end. (Separately, the ingredient-string residue in meal_ingredients is
-- a different, deliberately unfixed item.)
--
-- ============================================================================
-- RECOVERABLE BEFORE-STATE (meal — step number — original text), captured
-- 2026-07-24 immediately before the UPDATEs below:
-- ============================================================================
--
-- Chicken Fajita Stuffed Bell Pepper (16 steps) — DELETE steps 11-16:
--   11. Facebook
--   12. Pinterest
--   13. Yummly
--   14. Twitter
--   15. Google+
--   16. email
--   (steps 1-10 retained unchanged)
--
-- Miso Soup With Thin Noodles (5 steps) — DELETE steps 4-5:
--   4. What do you usually add to your Miso Soup?
--   5. Seriously Soupy Serena
--   (steps 1-3 retained unchanged)
--
-- King Crab Risotto (1 step) — DELETE step 1 (its only step; leaves [] ):
--   1. Follow all steps here: http://wp.me/pGpdt-bG
--
-- Pork Shoulder Tacos with Chipotle Greek Yogurt and Coleslaw (7 steps) —
-- TRIM step 7, cutting the trailing "Nutritional information is per taco.":
--   7 (original): Mix thoroughly and serve on your taco.To assemble the tacos,
--      simply heat your favorite tortilla on the stove until warm. Spoon desired
--      amount of meat, chipotle Greek yogurt sauce, and coleslaw on the tortilla
--      and enjoy!Nutritional information is per taco.
--   7 (kept):     ...and coleslaw on the tortilla and enjoy!
--
-- KEEP (untouched, listed for the record): Beef Teriyaki Stir Fry step 7
-- "Serve.", Eggplant Parmesan step 4 "Serve!", Murg Malai Tikka step 18
-- "Enjoy!" — terse but legitimate final instructions.
-- ============================================================================

update meals set instructions = ARRAY[$s$To get started heat oven to 35$s$, $s$Mix salt, pepper, cilantro, cumin, chili powder, and quinoa together and place to the side.$s$, $s$Cut the bell pepper in half (if you havent already) and clean out the seeds.$s$, $s$Layer quinoa and then grilled chicken into the pepper, and then top each with cheese.$s$, $s$Place in the oven for about 10 minutes until the bell pepper has softened.$s$, $s$Chicken Fajita Stuffed Bell Pepper$s$, $s$Top with avocado and serve with shredded lettuce and salsa for a complete meal.$s$, $s$This is SO GOOD! I love bell peppers, and I love all of these flavors that are married together that make this chicken fajita stuffed bell pepper so amazing. I could seriously just eat the flavored quinoa all by itself.$s$, $s$If you are looking for even more delicious and healthy recipes, make sure you head over to the Simple Fit Forty tab under the cooking section of this blog.  We have all of our favorite healthy recipes listed for you right there in one spot. You can also drool over out latest on the Simple Fit Forty Instagram page.$s$, $s$If you are looking to get healthy and fit, come and join the super secret and awesome Simple Fit Forty Lifestyle community over on Facebook.  We would love to have you join!$s$]::text[] where name = $n$Chicken Fajita Stuffed Bell Pepper$n$;

update meals set instructions = ARRAY[$s$After the miso has been prepared, start adding the "stuff" to the soup pot. It can be your preference, but I opted to start with the onions and chives and then added the zucchini, parsnip, carrots, mushrooms and ginger. Cover the pot and let cook on a low flame for 20-30 minutes, tasting as you go.$s$, $s$Add the tofu and pasta, allowing the pasta to cook for 8-10 minutes. Taste the soup, adding red pepper and turn off flame when ready.$s$, $s$Place spinach on the bottom of your soup bowl. You can also place the spinach directly in the pot, but since it wilts so quickly I usually do it this way.$s$]::text[] where name = $n$Miso Soup With Thin Noodles$n$;

update meals set instructions = ARRAY[]::text[] where name = $n$King Crab Risotto$n$;

update meals set instructions = ARRAY[$s$Place all ingredients in the crock pot.  Cook for 5 hours on low.  Meat should be tender and easily shred when finished cooking.To Make the Chipotle Greek Yogurt:In a small bowl, add the Greek yogurt.  Crack open your can of chipotle chilies in adobo sauce and remove the seeds from 3 or 4 of the chilies (about half of the can). Finely chop and add to the Greek yogurt.$s$, $s$Add about a teaspoon of the adobo sauce.  Stir. For a spicier sauce, add additional chipotle chilies.To Make the no-mayo coleslaw:Thinly slice the cabbage and chop the green onion.  Peel and julienne the carrot.$s$, $s$Add all veggies to a large mixing bowl.$s$, $s$Mix the lime juice, apple cider vinegar and olive oil together in a small bowl.$s$, $s$Drizzle the liquid over the veggies.$s$, $s$Add salt and pepper to taste and if youre one of those cilantro people, add a handful of chopped cilantro.$s$, $s$Mix thoroughly and serve on your taco.To assemble the tacos, simply heat your favorite tortilla on the stove until warm. Spoon desired amount of meat, chipotle Greek yogurt sauce, and coleslaw on the tortilla and enjoy!$s$]::text[] where name = $n$Pork Shoulder Tacos with Chipotle Greek Yogurt and Coleslaw$n$;
