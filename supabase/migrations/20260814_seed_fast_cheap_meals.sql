-- Catalog: add 12 fast-and-cheap meals to close the 15-min gap.
--
-- ADDITIVE ONLY. Never deletes; never touches the recommend_meals RPC or any
-- existing meal. Re-runnable: each meal is guarded by a UNIQUE external_id
-- ('manual-fast-01'..'-12') and each ingredient by (meal_id, name), so running
-- this twice inserts nothing the second time.
--
-- Row contract (verified against the live meals table):
--   * id            -> omitted; column default gen_random_uuid() supplies it.
--   * cuisine_id    -> resolved AT RUN TIME from cuisines.name (never a literal
--                      uuid), so a wrong hex can't silently drop a meal.
--   * effort_level  -> set EXPLICITLY 1/2/3 (NULL would break the RPC score).
--   * source='manual', dietary_tags='{}', image_url=NULL (safe Greige block),
--     instructions = 3-5 short steps so the "How to make it" tab is non-empty.
--   * meal_ingredients -> 5-8 real lowercase single-item names per meal, so the
--     gap tracker + avoid-exclusion tokenize correctly.
-- All meals: cook_time_min <= 15 AND est_cost <= 2.50.

begin;

-- ── chinese ─────────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Egg Fried Rice', c.id, 1, 12, 2.20, 'manual', 'manual-fast-01', '{}'::text[], null,
       'A fast weeknight fried rice.',
       array['Heat oil in a wok over high heat.','Scramble the eggs and set aside.','Add cold cooked rice and stir-fry to separate the grains.','Return the eggs, add soy sauce and green onion, and toss.','Finish with sesame oil and serve.']::text[]
from cuisines c
where c.name = 'chinese'
  and not exists (select 1 from meals where external_id = 'manual-fast-01');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('egg'),('cooked rice'),('soy sauce'),('green onion'),('garlic clove'),('sesame oil'),('vegetable oil'),('carrot')) as v(name)
where m.external_id = 'manual-fast-01'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Soy Garlic Noodles', c.id, 2, 13, 2.40, 'manual', 'manual-fast-02', '{}'::text[], null,
       'Glossy garlic noodles in minutes.',
       array['Cook the noodles until just tender, then drain.','Saute minced garlic in oil until fragrant.','Stir in soy sauce and a pinch of sugar.','Toss the noodles in the sauce to coat.','Top with green onion and sesame oil.']::text[]
from cuisines c
where c.name = 'chinese'
  and not exists (select 1 from meals where external_id = 'manual-fast-02');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('noodles'),('soy sauce'),('garlic clove'),('green onion'),('sesame oil'),('sugar'),('vegetable oil')) as v(name)
where m.external_id = 'manual-fast-02'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

-- ── thai ────────────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Thai Basil Fried Egg Rice', c.id, 1, 14, 2.30, 'manual', 'manual-fast-03', '{}'::text[], null,
       'Fragrant basil and a crispy fried egg over rice.',
       array['Fry an egg in hot oil until the edges crisp.','Add garlic and chili and stir briefly.','Add cooked rice and toss to heat through.','Season with fish sauce and soy sauce.','Fold in thai basil and serve.']::text[]
from cuisines c
where c.name = 'thai'
  and not exists (select 1 from meals where external_id = 'manual-fast-03');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('egg'),('cooked rice'),('thai basil'),('garlic clove'),('fish sauce'),('soy sauce'),('chili'),('vegetable oil')) as v(name)
where m.external_id = 'manual-fast-03'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Thai Peanut Noodles', c.id, 1, 13, 2.40, 'manual', 'manual-fast-04', '{}'::text[], null,
       'Creamy peanut noodles, no cooking the sauce.',
       array['Cook the noodles and drain.','Whisk peanut butter, soy sauce and lime into a sauce.','Loosen with a splash of warm water.','Toss the noodles in the peanut sauce.','Top with green onion and chili flakes.']::text[]
from cuisines c
where c.name = 'thai'
  and not exists (select 1 from meals where external_id = 'manual-fast-04');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('noodles'),('peanut butter'),('soy sauce'),('lime'),('garlic clove'),('green onion'),('chili flakes')) as v(name)
where m.external_id = 'manual-fast-04'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

-- ── korean ──────────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Gyeran Bap (Egg Rice)', c.id, 1, 10, 1.80, 'manual', 'manual-fast-05', '{}'::text[], null,
       'Warm rice, a fried egg, soy and sesame.',
       array['Fry an egg in butter to your liking.','Warm the cooked rice in a bowl.','Drizzle the rice with soy sauce and sesame oil.','Top with the fried egg and green onion.','Sprinkle sesame seeds and mix at the table.']::text[]
from cuisines c
where c.name = 'korean'
  and not exists (select 1 from meals where external_id = 'manual-fast-05');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('egg'),('cooked rice'),('soy sauce'),('sesame oil'),('green onion'),('sesame seed'),('butter')) as v(name)
where m.external_id = 'manual-fast-05'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Kimchi Fried Rice', c.id, 2, 14, 2.40, 'manual', 'manual-fast-06', '{}'::text[], null,
       'Tangy kimchi fried rice topped with an egg.',
       array['Saute chopped kimchi in sesame oil.','Add cooked rice and stir-fry to combine.','Season with a little soy sauce.','Push aside and fry an egg in the pan.','Top the rice with the egg and green onion.']::text[]
from cuisines c
where c.name = 'korean'
  and not exists (select 1 from meals where external_id = 'manual-fast-06');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('kimchi'),('cooked rice'),('egg'),('green onion'),('sesame oil'),('soy sauce'),('vegetable oil')) as v(name)
where m.external_id = 'manual-fast-06'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

-- ── vietnamese ──────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Vietnamese Egg Noodles', c.id, 1, 13, 2.40, 'manual', 'manual-fast-07', '{}'::text[], null,
       'Quick stir-tossed egg noodles.',
       array['Boil the egg noodles until tender, then drain.','Saute garlic in oil until fragrant.','Add soy sauce and fish sauce to the pan.','Toss the noodles and bean sprout in the sauce.','Finish with green onion and sesame oil.']::text[]
from cuisines c
where c.name = 'vietnamese'
  and not exists (select 1 from meals where external_id = 'manual-fast-07');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('egg noodles'),('soy sauce'),('garlic clove'),('green onion'),('fish sauce'),('sesame oil'),('bean sprout')) as v(name)
where m.external_id = 'manual-fast-07'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Garlic Lime Rice Bowl', c.id, 1, 12, 2.10, 'manual', 'manual-fast-08', '{}'::text[], null,
       'Bright garlic and lime over warm rice.',
       array['Saute minced garlic in oil until golden.','Add cooked rice and toss to coat.','Squeeze in fresh lime and a dash of fish sauce.','Fold in chopped cilantro and green onion.','Serve warm in a bowl.']::text[]
from cuisines c
where c.name = 'vietnamese'
  and not exists (select 1 from meals where external_id = 'manual-fast-08');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('cooked rice'),('garlic clove'),('lime'),('cilantro'),('fish sauce'),('green onion'),('vegetable oil')) as v(name)
where m.external_id = 'manual-fast-08'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

-- ── american ────────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Grilled Cheese and Tomato', c.id, 1, 10, 2.00, 'manual', 'manual-fast-09', '{}'::text[], null,
       'A crisp, melty diner classic.',
       array['Butter the outside of two bread slices.','Layer cheddar and sliced tomato between them.','Grill in a pan over medium heat.','Press and flip until golden on both sides.','Slice in half and serve hot.']::text[]
from cuisines c
where c.name = 'american'
  and not exists (select 1 from meals where external_id = 'manual-fast-09');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('bread'),('cheddar cheese'),('tomato'),('butter'),('mayonnaise'),('black pepper')) as v(name)
where m.external_id = 'manual-fast-09'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Peanut Butter Banana Toast', c.id, 1, 5, 1.50, 'manual', 'manual-fast-10', '{}'::text[], null,
       'A five-minute sweet and savory toast.',
       array['Toast the bread until golden.','Spread a thick layer of peanut butter.','Top with banana slices.','Drizzle with honey and dust with cinnamon.','Serve right away.']::text[]
from cuisines c
where c.name = 'american'
  and not exists (select 1 from meals where external_id = 'manual-fast-10');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('bread'),('peanut butter'),('banana'),('honey'),('cinnamon')) as v(name)
where m.external_id = 'manual-fast-10'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

-- ── indian ──────────────────────────────────────────────────────────────────
insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Egg Bhurji (Masala Scrambled Eggs)', c.id, 1, 13, 2.20, 'manual', 'manual-fast-11', '{}'::text[], null,
       'Spiced scrambled eggs, quick and hearty.',
       array['Saute chopped onion in oil until soft.','Add tomato, green chili, turmeric and cumin.','Pour in beaten eggs and stir to scramble.','Cook until just set and fluffy.','Garnish with cilantro and serve.']::text[]
from cuisines c
where c.name = 'indian'
  and not exists (select 1 from meals where external_id = 'manual-fast-11');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('egg'),('onion'),('tomato'),('green chili'),('turmeric'),('cumin'),('cilantro'),('vegetable oil')) as v(name)
where m.external_id = 'manual-fast-11'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

insert into meals (name, cuisine_id, effort_level, cook_time_min, est_cost, source, external_id, dietary_tags, image_url, description, instructions)
select 'Jeera Rice (Cumin Rice)', c.id, 1, 15, 1.90, 'manual', 'manual-fast-12', '{}'::text[], null,
       'Fragrant cumin-tempered basmati rice.',
       array['Rinse the basmati rice until the water runs clear.','Temper cumin seeds and bay leaf in ghee.','Add the rice and toss to coat.','Add water and simmer until fluffy.','Fluff, garnish with cilantro and serve.']::text[]
from cuisines c
where c.name = 'indian'
  and not exists (select 1 from meals where external_id = 'manual-fast-12');

insert into meal_ingredients (meal_id, name)
select m.id, v.name
from meals m
cross join (values ('basmati rice'),('cumin seed'),('ghee'),('onion'),('bay leaf'),('salt'),('cilantro')) as v(name)
where m.external_id = 'manual-fast-12'
  and not exists (select 1 from meal_ingredients mi where mi.meal_id = m.id and mi.name = v.name);

commit;
