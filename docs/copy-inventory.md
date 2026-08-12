# Copy Inventory

Fresh snapshot of every user-facing display string, regenerated after the copy pass, cuisine-avoid removal, chip/a11y polish, card re-layout, and the History build. Grouped by route/screen in reading order. Format: `path:LINE` — "verbatim string". Casing/punctuation preserved (note `&apos;` in JSX vs typographic `’` in JS strings). Dynamic/template strings marked **(dynamic)** with literal parts shown.

No central strings file — all copy is inline in its screen/component; shared display constants live in `lib/` (`greeting.ts`, `format.ts`, `recommend.ts`, `reasons.ts`, `pantryCategories.ts`, label maps in `profile.ts`).

---

## 1. Splash / landing

`app/index.tsx:48` — "One moment…"
`app/welcome.tsx:21` — "Sate"
`app/welcome.tsx:23` — "Three meals, picked for your taste — decide in seconds."
`app/welcome.tsx:28` — "Sign up" (PrimaryButton)
`app/welcome.tsx:35` — "Log in" (now `textSecondary`, not accent — the a11y contrast fix)

## 2. Auth

### `app/auth/register.tsx`
`:34` — "Enter your email"
`:38` — "Password must be at least 6 characters"
`:42` — "Passwords don't match"
`:58` — "That email is already registered"
`:62` — "Couldn't create your account. Try again." (’)
`:90` — "Create your account"
`:92` — "You can start right away."
`:98` — "Email"
`:103` — "you@example.com" (placeholder)
`:114` — "Password"
`:120` — "At least 6 characters" (placeholder)
`:144` — "Confirm password"
`:150` — "Re-enter password" (placeholder)
`:182` — "Log in instead"
`:196` — "Continue with Google"
`:203` — "Continue with Apple"
`:207` — "Coming soon"
`:215` — **(dynamic)** "One moment…" / "Create account" (submitting ? … : …)

### `app/auth/login.tsx`
`:25` — "Enter your email"
`:29` — "Enter your password"
`:40` — "Couldn't log in. Try again." (’)
`:75` — "Log in"
`:77` — "Welcome back" (no period — the interstitial-removal copy)
`:83` — "Email"
`:88` — "you@example.com" (placeholder)
`:100` — "Password"
`:106` — "Your password" (placeholder)
`:137` — "New here? Sign up"
`:144` — **(dynamic)** "One moment…" / "Log in" (submitting ? … : …)

## 3. Onboarding

### `app/onboarding/taste.tsx` — step 1
`:67` — "Step 1 of 3"
`:71` — "What do you like to eat?"
`:76` — "Pick up to three"
`:82` — **(dynamic)** `` `${emoji} ${display_label}` `` — cuisine chip, both parts from DB
`:93` — "Continue"

### `app/onboarding/avoid.tsx` — step 2 (cuisine-avoid section removed)
`:15` — "Vegetarian", "Vegan", "Gluten-free", "Dairy-free" (`DIETARY_OPTIONS`, visual-only)
`:66` — "Step 2 of 3"
`:70` — "Anything to avoid?"
`:72` — "Optional — leave out anything you'd rather not see." (&apos;)
`:78` — "Ingredients"
`:84` — "Type an ingredient, press enter" (placeholder)
`:100` — "Dietary"
`:117` — "Continue"

### `app/onboarding/constraints.tsx` — step 3
`:18-20` — "Easy" / "Minimal prep, few steps" · "Medium" / "A bit of cooking" · "Involved" / "Worth the extra time"
`:24-26` — "Low" / "Under $3 a serving" · "Medium" / "$3–6 a serving" · "High" / "No limit"
`:32-35` — "15 min", "30 min", "45 min", "60+ min"
`:64`, `:89` — "Couldn't save just now. Try once more." (’)
`:122` — "Step 3 of 3"
`:126` — "What works for you most nights?"
`:131` — "Cook time"
`:148` — "Budget"
`:170` — "Effort"
`:199` — **(dynamic)** "Saving…" / "Continue"

### `app/onboarding/_layout.tsx` — shared
`:32` — "×" (RemovableTag remove glyph). *(CheckRow export removed with the cuisine-avoid feature.)*

## 4. Home

`lib/greeting.ts:27-29` — "What's for breakfast?" / "What's for lunch?" / "What's for dinner?" (by local hour; rendered via `getMealGreeting` at `home.tsx:108`)
`app/(tabs)/home.tsx:17-20` — "15 min", "30 min", "45 min", "60+ min"
`app/(tabs)/home.tsx:24-26` — "Low", "Medium", "High"
`app/(tabs)/home.tsx:30` — "Tired", "Comfort", "Adventurous", "Light", "Quick" (`MOOD_OPTIONS`)
`app/(tabs)/home.tsx:65`, `:90`, `:97` — "Couldn't set up tonight. Check your connection and try again." (’)
`app/(tabs)/home.tsx:111` — "A few quick things — get three meals"
`app/(tabs)/home.tsx:116` — "Cook time"
`app/(tabs)/home.tsx:132` — "Budget"
`app/(tabs)/home.tsx:148` — "Mood — optional"
`app/(tabs)/home.tsx:172` — **(dynamic)** "One moment…" / "See three meals"

## 5. Recommendations (three-meal cards)

### `app/request/[id].tsx`
`:45-47` — **(dynamic)** cuisine eyebrow: `` `${cuisine.charAt(0).toUpperCase()}${cuisine.slice(1)}` `` — title-cased in source, renders **ALLCAPS** (caption role, no dataCaption override). e.g. "JAPANESE"
`:51` — **(dynamic)** `` `${cook_time_min} min · ≈$${est_cost.toFixed(2)}` `` — de-capped meta, ONE dot. e.g. "30 min · ≈$1.50". Literal parts: " min · ≈$"
`:58` — "A little longer than usual" (de-capped)
`:108` — "Picking three meals…"
`:117` — "That slipped away."
`:119` — "We couldn't pull three meals just now. Try once more." (&apos;)
`:122` — "Try again"
`:145` — **(dynamic)** `` `${bucketLabel}: three meals` `` → "Breakfast/Lunch/Dinner: three meals". Literal: ": three meals"
`:147` — "Tap one to see why"
`:172` — "Back to start"

### `lib/recommend.ts` — tier labels + card explanation
`:25-27` — "Familiar", "Adjacent", "Stretch" (`TIER_LABEL` — **exported but not rendered** on any screen)
`:41` — **(dynamic)** `` `A familiar ${cuisine} pick, right in your lane.` ``
`:43` — **(dynamic)** `` `One small step over — still comfortable ${cuisine}.` ``
`:45` — **(dynamic)** `` `Something new: ${cuisine}.` ``

## 6. Meal detail

### `app/option/[id].tsx` — why this one (meal name is now the `display` title; "Here's why" removed)
`:68` — "Working out why…" (loading)
`:77` — "Lost the thread." (error)
`:79` — "We couldn't pull this one up. Try again." (&apos;)
`:82` — "Try again"
`:105` — **(dynamic)** `{why.name}` — `display` (the page title)
`:107` — **(dynamic)** `{subtitle}` — cuisine label
`:119` — **(dynamic)** `{line}` — each reason (strings from `lib/reasons.ts`)
`:127` — **(dynamic)** `` `${cookTimeMin} min` `` · `formatCost(estCost)`. Literal: " min", " · "
`:142` — "See what's in it"
`:156` — "Back to three meals"

### `lib/reasons.ts` — the "why" lines
`:31-33` — "Right in your usual lane." · "A small step from what you know." · "A little further than usual — worth a try."
`:94` — **(dynamic)** `` `You tend to like ${cuisineLabel}.` ``
`:99` — "Low effort, like you wanted."
`:101` — "About the effort you're up for."
`:103` — "A little easier than usual."
`:109` — "Fits your time."
`:111` — "A little longer, but close."
`:117` — "Comfortable on your budget."

### `app/meal/[id].tsx` — gap + steps + make-this
`:15-17` — "Easy", "Medium", "Involved" (`EFFORT_LABEL`)
`:107` — "Couldn't add that. Try again." (’)
`:121` — "Checking your pantry…"
`:130` — "Couldn't open this." (&apos;)
`:132` — "The details didn't load. Try again." (&apos;)
`:135` — "Try again"
`:142` — **(dynamic)** `` `Effort ${gap.effortLevel}` `` (fallback). Literal: "Effort "
`:170` — **(dynamic)** `{gap.cuisineLabel}` (eyebrow, conditional)
`:173` — **(dynamic)** `{gap.name}` (title)
`:175` — **(dynamic)** `` `${cookTimeMin} min` `` · `{effort}` · `formatCost(estCost)`
`:180` — **(dynamic)** `` `You have ${haveCount} of ${gap.m}` `` — literal: "You have ", " of "
`:184` — "One ingredient didn't match either list — counts may be off." (&apos;)
`:191` — "What you have"
`:197` — "✓" (`color="have"` — the only Sage in the app)
`:208` — "What to buy"
`:225` — "+" (add marker — the whole row is the tap target)
`:245` — "How to make it"
`:250` — **(dynamic)** `` `${i + 1}` `` — step number
`:264` — **(dynamic)** "Show fewer steps" / `` `Show all ${steps.length} steps` ``
`:274` — "Make this"
`:288` — "Back"

### `app/confirm/[id].tsx` — handled
`:29` — "We couldn't link this to your three meals, but it's yours to make." (’)
`:37` — "We couldn't save the pick just now — no matter, go make it." (’)
`:61` — "You're set" (&apos;)
`:65` — **(dynamic)** `` `You're making ${meal.name}` `` (’) — literal: "You're making "
`:68` — **(dynamic)** `` `${cook_time_min} min` `` · `formatCost(est_cost)`
`:91` — "Back to start"
*(mounts `FeedbackControl` — see §10)*

## 7. Pantry (inline; detail page deleted)

### `app/(tabs)/pantry.tsx`
`:22` — "rice", "pasta", "eggs", "olive oil", "garlic", "onion", "shrimp", "chicken" (`QUICK_ADD`, lowercase)
`:29-30` — "Barcode scan" / "Skip the typing — scan to fill your pantry." · "AI Chef" / "Turn what's in your pantry into new recipes." (`PREMIUM`)
`:112` — "Couldn't add that. Try again." (’)
`:145` — "Couldn't move that. Try again." (’) (move sheet)
`:172`, `:187` — "Couldn't remove that. Try again." (’)
`:201` — "Pantry"
`:203` — "What's in your kitchen — Sate tracks the gaps." (&apos;)
`:210` — "Add an item"
`:216` — "Type an item, press enter" (placeholder)
`:222` — **(dynamic)** "Adding…" / "Add"
`:227` — **(dynamic)** `` `Added to ${toSentenceCase(justAdded.category)}` `` — the "where did it go?" confirmation. Literal: "Added to "
`:239` — "Quick add" *(owned staples render as "✓ {name}", tappable to remove)*
`:264` — "Loading…"
`:269` — "Couldn't load your pantry." (&apos;)
`:273` — "Try again"
`:279` — "Nothing here yet — add a staple above."
`:294` — **(dynamic)** `toSentenceCase(cat)` — category header (ALLCAPS via caption)
`:301` area — **(dynamic)** `{item.name}` — pantry item row
`:321` — "More, with Premium"
`:338` — "Premium" (badge)
`:347` — "Coming soon"
`:367` — **(dynamic)** `{sheetItem.name}` — move-sheet title
`:370` — "Move to"
`:382` — **(dynamic)** `toSentenceCase(target)` — move-target row
`:391` — "Remove"
`:396` — "Cancel"

### `lib/pantryCategories.ts`
`:11-16` — "Proteins", "Dairy", "Fats & oils", "Grains", "Produce", "Seasonings"
`:20` — `CATEGORY_ORDER`: "Proteins", "Produce", "Grains", "Dairy", "Fats & oils", "Seasonings", "Other"
`:28` — "Other" (fallback)

### `app/scanner.tsx`
`:105` — "Couldn't add that. Try again." (’)
`:119` — "Camera access"
`:121` — "Sate needs your camera to scan barcodes"
`:124` — "Allow camera"
`:127` — "Enable camera for Sate in your device Settings"
`:133` — "Back"
`:168` — "Point at a product barcode"
`:179` — "Looking up…"
`:192` — **(dynamic)** `{product.name}`
`:195` — **(dynamic)** `{product.brand}`
`:201` — "Add to pantry" (button, found)
`:211` — "Add to pantry" (title, confirm)
`:219` — "Item name" (placeholder)
`:224` — **(dynamic)** `` `${product.name} · ${product.brand}` `` / `product.name` — reference line
`:229` — **(dynamic)** "Adding…" / "Add"
`:203`, `:234`, `:252`, `:276` — "Scan again"
`:242` — "Not in database"
`:244` — "Sate couldn't find this product." (’)
`:258` — "Done"
`:266` — "Lookup failed"
`:268` — "Check your connection and try again."
`:272` — "Try again"

## 8. Profile ("Start over" removed; Avoids now lists items)

### `app/(tabs)/profile.tsx`
`:80` — "Couldn't delete your account. Try again." (’)
`:87` — "Profile"
`:94` — "Account"
`:96` — **(dynamic)** `{account.email}`
`:99` — "Log out"
`:107` — "Taste"
`:111` — "Favorite"
`:116` — **(dynamic)** `favoriteCuisines.join(' · ')` / "Not set"
`:121` — "Avoids"
`:124` — **(dynamic)** `avoids.join(' · ')` / "None" (legacy cuisine labels + ingredient names)
`:129` — "Effort"
`:131` — **(dynamic)** `{effortLabel}` / "Not set"
`:135` — "Budget"
`:137` — **(dynamic)** `{budgetLabel}` / "Not set"
`:145` — "Edit taste"
`:159` — "Delete account" (trigger)
`:165` — "This permanently removes your taste and pantry. You can't undo this." (&apos;)
`:176` — **(dynamic)** "Deleting…" / "Delete permanently" (confirm)
`:187` — "Cancel"

### `lib/profile.ts`
`:21` — "Easy", "Medium", "Involved" (`EFFORT_LABEL`)
`:22` — "Low", "Medium", "High" (`BUDGET_LABEL`)

### `app/taste/edit.tsx` — taste editor (cuisine-avoid section removed)
`:18-20` — "Easy" / "Minimal prep, few steps" · "Medium" / "A bit of cooking" · "Involved" / "Worth the extra time"
`:23-25` — "Low" / "Under $3 a serving" · "Medium" / "$3–6 a serving" · "High" / "No limit"
`:42` — "×" (local RemovableTag glyph)
`:121` — "Couldn't save your taste. Try once more." (’)
`:132` — "Loading your taste…"
`:141` — "Couldn't open this." (&apos;)
`:143` — "Try again."
`:164` — "Your taste"
`:168` — "Favorite cuisine"
`:171` — "Pick up to three"
`:177` — **(dynamic)** `` `${emoji} ${display_label}` `` — cuisine chip
`:187` — "Ingredients to avoid"
`:193` — "Type an ingredient, press enter" (placeholder)
`:210` — "Effort"
`:231` — "Budget"
`:258` — **(dynamic)** "Saving…" / "Save"

## 9. Premium / upsell

### `app/premium.tsx`
`:14-15` — "AI Chef" / "Turn what's in your pantry into new recipes." · "Barcode scan" / "Skip the typing — scan to fill your pantry."
`:32` — "One more thing"
`:34-35` — "Scan a barcode instead of typing, and AI Chef turns what you have into new recipes. Both are optional — the app works free without them."
`:53` — "Premium" (badge)
`:71` — "Unlock with Premium"
`:76` — "Coming soon"
`:82` — "Continue"

## 10. History (new) + shared

### `app/(tabs)/history.tsx` — now wired to `loadHistory`
`:54` — "Loading…"
`:63` — "Couldn't load your history." (&apos;) *(error state)*
`:68` — "Try again"
`:79` — "Nothing here yet — the meals you make show up here."
`:88` — "History"
`:100` — **(dynamic)** `` `${formatDate(e.createdAt)} · ${e.cuisineLabel}` `` — row meta, e.g. "Jul 10 · Japanese". Plus `{e.name}` (meal name) on the left.

### `lib/format.ts`
`:9` — **(dynamic)** `` `≈ $${estCost.toFixed(2)} / serving` `` (`formatCost` — used on option/meal/confirm; NOT the terse card form)
`:34` — **(dynamic)** `` `${MONTHS[d.getMonth()]} ${d.getDate()}` `` (`formatDate` → "Jul 10"). `MONTHS` = Jan…Dec (`:31`)

### `app/(tabs)/_layout.tsx` — bottom tab bar
`:84` — "One moment…" (guard checking)
`:116`/`:117` — "Home" (title / tabBarLabel — rendered UPPERCASE)
`:126`/`:127` — "History"
`:136`/`:137` — "Pantry"
`:146`/`:147` — "Profile"

### `components/FeedbackControl.tsx` — taste pills (mounted on Handled)
`:10` — "Loved it"
`:11` — "Not for me"
`:41` — "Couldn't load your last take." (’)
`:58`, `:71` — "Couldn't save that. Try again." (’)
`:84` — "Your take"
*(`rating_type` enum has a third value "fine" with no label; `reason_type` chips are unbuilt.)*

### Components with no own copy
`components/Chip.tsx`, `components/PrimaryButton.tsx`, `components/Screen.tsx`, `components/Text.tsx` — labels via props; no hardcoded strings.

---

## What materially changed vs the original inventory

This snapshot reflects everything since the first inventory:

- **Auth:** the login "unsaved data" interstitial copy is gone; "Welcome back" lost its period; "New here? Save an account" → "New here? Sign up"; register drops the "we'll send a link" promise → "You can start right away."
- **Onboarding:** the entire **cuisines-to-avoid** section was removed from step 2 *and* the taste editor — "Cuisines to skip/avoid", "Your favorite", and the `CheckRow` export are **gone**. Step-2 heading is now "Anything to avoid?"; labels de-verbed to "Ingredients"/"Dietary". Step-3 heading "How much are you up for?" → "What works for you most nights?"; "Cooking" section → "Effort".
- **Three-meal flow noun unified:** "your three"/"suggestions" → **"three meals"** across home ("See three meals", "A few quick things — get three meals"), request ("Picking three meals…", "…: three meals"), option ("Back to three meals").
- **Recommendation card re-layout:** cuisine moved OUT of the meta into an **ALLCAPS eyebrow above the name**; meta de-capped to one dot ("30 min · ≈$1.50"); over-time note de-capped.
- **"Why" screen:** "Here's why" heading **removed**; the meal name is now the `display` title. Loading line is "Working out why…".
- **Pantry:** category **detail page deleted** (inline now); new **"Added to {Category}"** add-confirmation; owned quick-add chips show "✓ {name}"; move/remove errors moved onto the tab.
- **Profile:** **"Start over"** removed (dup of Log out); **Avoids** now lists actual items (was a bare count) with "None" empty; delete confirm escalates to **"Delete permanently"**.
- **Premium:** vague "adds a little more / all set without it" → concrete "Scan a barcode… AI Chef…"; card subtitles rewritten.
- **History:** was a static "Your past picks will live here." placeholder — now a **live list** ("History", dated rows, "Loading…", "Couldn't load your history.", "Nothing here yet — the meals you make show up here.").
- **Punctuation/casing normalized:** loading states unified to the "…" form ("Loading…", "Adding…", "Looking up…", "Deleting…"); errors to "Couldn't X. Try again."; card data lines de-capped; `formatDate` added.
