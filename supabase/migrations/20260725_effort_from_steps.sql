-- Decouple meals.effort_level from cook time: re-derive from STEP COUNT
-- (length of the cleaned instructions array), buckets: <=4 -> 1, 5-8 -> 2, >=9 -> 3.
-- Rationale: effort_level was effortFromTime(cook_time_min), collinear with the
-- time filter (lopsided 3/26/41). Step count is orthogonal to cook time and
-- reflects hands-on effort. Data only -- no schema, no RPC. Reversible via the
-- full before-state dump below (id, old effort_level, cleaned step count).
--
-- Phase B manual overrides (step count can't classify these):
--   King Crab Risotto -> 3, Garlic Lemon Chili Broccoli -> 1  (both 0 steps = missing data),
--   Chelley's Thai Style Chicken Satay -> 3  (under-seeded at 2 steps, genuinely fussy).
--
-- ============================================================================
-- RECOVERABLE BEFORE-STATE (id  old_effort  cleaned_step_count  name), 2026-07-25:
-- ============================================================================
--   8191e551-09ad-4ce0-b714-1e18a9da4dab  old=3  steps=10  17 Bean White Chicken Chili
--   97534322-fe60-4bbf-81b7-e7098377399f  old=3  steps=28  Assam Fish Curry
--   b70547e9-e843-4874-870b-feb3ea4ee4a1  old=2  steps= 7  Beef Teriyaki Stir Fry
--   cab03749-6bfd-42c6-90ec-9d2354983302  old=2  steps=11  Bibimbab (Korean Rice w Vegetables & Beef)
--   fe44fa1f-cb6d-4285-8ded-3b7999d985f1  old=2  steps= 5  Broccolini Quinoa Pilaf
--   264a5f1b-8b42-4372-89e4-8c868db048db  old=2  steps= 7  Cabbage Soup with Spicy Kimchi
--   cc410d1d-7179-467e-8f8c-e8a08b672911  old=3  steps= 6  Chai Pani’s Malabar Chicken Curry
--   5cfbdb7b-fd93-43a2-b63d-764a0632eec4  old=2  steps= 8  Chapchae (Korean Stir-Fried Noodles)
--   2c9c5f7a-8a72-4393-adf8-5951cf6f6778  old=2  steps= 4  Cheesy Chicken Enchilada Quinoa Casserole
--   6974286f-f741-4441-a5f3-ee625511e5e3  old=3  steps= 2  Chelley's Thai Style Chicken Satay
--   cb634684-e216-412b-94df-9d9483a5ee0f  old=2  steps= 4  Chicken and Miso Ramen Noodle Soup
--   72e16c21-02f3-48c0-be56-c1a18ee9b39f  old=3  steps= 9  Chicken Enchilada Casserole
--   1e7c2f40-fbef-4343-b596-a6c2fe1b62e0  old=2  steps= 6  Chicken Fajita Stuffed Bell Pepper
--   c4a2469f-f144-438e-85c0-053162304d99  old=2  steps=21  Chilled Avocado and Cucumber Soup With Prawn and Scallop Salsa
--   27793daf-1566-4872-9b53-ee50aec33cf1  old=3  steps= 6  Chinese Bbq Pork Ribs
--   a2b28b34-2b10-4464-ac17-fb75b5a10a55  old=3  steps= 7  Chinese Hot Pots and Low-Carb
--   fda9afbe-f680-4a31-8747-0d08131840c7  old=3  steps= 9  Chinese Style Stewed Meatballs
--   5a8e5947-be21-45d5-a0bd-fb326a6b231a  old=3  steps= 8  Chipotle Turkey Chili
--   4790d693-9192-47b8-a4d5-19ac8065d5f5  old=2  steps= 3  Chunky Two-Bean Chili
--   97e47357-dda3-4f5c-8d18-9a06ca7b8884  old=3  steps=10  Classic Macaroni and Cheese
--   dea7d882-c07b-4955-89a7-e53223f409ce  old=3  steps= 6  Crock Pot Chicken Pho
--   dd9ec5fc-4be3-42ed-9ba2-1604fc2d8513  old=3  steps= 4  Curry and Sage Roast Chicken
--   d42222a4-27b5-4d1e-8f54-f785761177d6  old=3  steps= 4  Eggplant Parmesan
--   7f3dd545-eb08-4f5b-997a-1a4218e73a46  old=2  steps= 3  Falafel Burgers
--   d6618b65-4e90-4255-9a78-4dd17e5a5e3f  old=3  steps= 9  Fried Rice
--   bf2f40ef-8a4a-4b76-98bf-e502ea174286  old=2  steps= 0  Garlic Lemon Chili Broccoli
--   ced84e06-3125-4073-af25-e60a97624187  old=2  steps= 5  Ginger Garlic Chili Salmon
--   7c88b7c3-81af-4907-b862-d1b77e1db083  old=2  steps= 8  Greek Lemon Chicken Orzo Soup
--   208aa63a-2f22-42b5-b047-a7abd28fdbd9  old=2  steps= 4  Greek-Style Baked Fish
--   fe2fe84e-3569-4280-89bd-c64e5a4a052c  old=3  steps=13  Green Thai Curry with Beef
--   28098c46-6e3e-4268-9498-014158e7c662  old=3  steps=12  Grilled Chicken Banh Mi
--   b20b355e-bfcb-4d85-b6e8-80477c1359ed  old=1  steps= 3  Grilled Salmon With Cherry, Pineapple, Mango Salsa
--   ef036a0b-8cfd-4c9f-87b0-69e53527bcb1  old=1  steps=12  Ground Pork Ramen
--   4e130121-106a-497a-a6f7-552f6babe9ef  old=3  steps= 3  Gyros
--   dd31e58b-e14c-451c-a587-eb426c7934df  old=2  steps= 7  How to Make the Perfect Sweet Potato Sloppy Joes
--   eb815635-b133-43b9-b3df-c135a45e5baa  old=3  steps= 6  Indian-Style Eggs On Toast
--   02728da7-d75e-4266-a43a-3c665cbf4c62  old=2  steps= 3  Instant Pot Pork Tenderloin Teriyaki
--   1f71145d-e13c-4204-ab1f-ced3bd882a07  old=1  steps= 2  Italian Tuna Pasta
--   4dd4afd6-9bf0-4398-bd8f-36d838feec5b  old=2  steps= 7  Japanese Sushi
--   761c1a24-ee20-4fb3-a862-4f8ca953143d  old=3  steps= 0  King Crab Risotto
--   0051c5ab-fb3a-4816-bb6f-070d90af7604  old=3  steps= 6  Korean Candy Chicken
--   8fbbfd52-a951-4d96-974b-90d341324f3a  old=3  steps=11  Lamb Moussaka
--   4f29dcdb-414a-49df-842b-8257b94aefbd  old=3  steps= 2  Mango Fried Rice
--   f46b251c-30d1-4890-b0ee-5c4ef42d4db4  old=3  steps= 5  Minestrone
--   e7bbccf8-db10-4fbb-b937-7811040efe3d  old=2  steps= 3  Miso Soup With Thin Noodles
--   1fe66a42-decc-4b9b-9231-04b9daf6c984  old=3  steps= 3  Moussaka With Portabella
--   ae57f95d-c779-4399-9c03-daaf53dae5b5  old=3  steps=18  Murg Malai Tikka
--   f927bc86-61c6-4f2b-8b8e-250144ef8ad6  old=3  steps=13  Oriental Filet Mignon on Crisp Kataifi with Shrimp Tempura
--   15994503-9572-4aae-916e-7acd9daf7980  old=3  steps= 7  Pachai Payaru Kulambu (Green Moong Dal Curry)
--   469eaf62-574d-425a-b618-fe300462b45a  old=3  steps= 3  Palak Paneer
--   8a38c58d-918a-41b6-9d43-a497750aa2ed  old=2  steps= 2  Pho With Zucchini Noodles
--   89416468-30b9-49db-9bad-bcc82e1221e5  old=3  steps= 7  Pork Fried Rice
--   3ab0b8bb-1206-49b1-87bf-78b575298c44  old=3  steps= 7  Pork Shoulder Tacos with Chipotle Greek Yogurt and Coleslaw
--   bdb9ab36-b17d-48ea-abdd-ea0af40ec68e  old=3  steps= 9  Pork Tenderloin With Mango-Kiwi Glaze Served With Tomatillo Salsa
--   f34ae5c5-113b-44d5-8dcf-3910363fe941  old=2  steps=17  Salmon Quinoa Risotto
--   754d029e-9269-4d24-81ca-4c1edaa149cd  old=3  steps= 6  Seared Pork Chops with Mango Salsa
--   2b734775-b046-48f4-9df1-af1befa471a3  old=3  steps= 4  Shrimp Fried Rice
--   a8fdbe21-3072-43bc-b489-ecbbc22a7a22  old=3  steps=10  Spanakopita (Greek Spinach Pie)
--   43b4b7b6-00ec-4ea5-86d3-b71ff5a2544b  old=3  steps= 4  Spicy Korean Bbq Pork
--   4f055a2c-93b3-4b0e-b8fe-ea98d1d7a5e3  old=3  steps=30  Sweet & Sour Chicken with Lychees
--   4d18f348-c4c4-425a-b62e-9e4f26c5dffc  old=2  steps= 7  Thai "Chicken" Wraps
--   0c724688-a824-4c07-aa2e-7ba706da5eb4  old=3  steps= 8  Thai Massaman Curry
--   1c3e9b32-adbe-47c9-a8f3-f75035b686fc  old=2  steps= 7  Thai Street Food Made at Home - Crazy Easy and Crazy Delicious in 30 Minutes
--   8b0f0491-dd91-49f3-a5d0-a07f9fafd4ee  old=2  steps= 8  Thai Tofu With Bok Choy
--   3667c70a-918e-4c29-9f9c-c87870e95b2b  old=2  steps= 7  Thai-Style Mussels
--   34642ec3-de7b-4481-86c7-0d242f8d601e  old=2  steps= 3  The Easiest Beef Pho
--   e7464b74-ac59-4649-b45c-c516e8266d19  old=3  steps= 8  Thinly Sliced Beef Yakitori
--   147207a4-5abd-4dcc-9d35-360ef2b7dbbb  old=3  steps= 9  Trinidadian Chicken Potato Curry
--   b337d950-0715-4317-bda4-1b889b01eea8  old=3  steps= 6  Vietnamese Banh Mi
--   5d47e323-beb8-4a6b-8157-3180e7a8f9b5  old=3  steps= 2  Vietnamese Noodle Salad With Tofu
-- ============================================================================

-- Phase A -- step-count buckets
update meals set effort_level = 1 where id in (
  '2c9c5f7a-8a72-4393-adf8-5951cf6f6778',
  'cb634684-e216-412b-94df-9d9483a5ee0f',
  '4790d693-9192-47b8-a4d5-19ac8065d5f5',
  'dd9ec5fc-4be3-42ed-9ba2-1604fc2d8513',
  'd42222a4-27b5-4d1e-8f54-f785761177d6',
  '7f3dd545-eb08-4f5b-997a-1a4218e73a46',
  '208aa63a-2f22-42b5-b047-a7abd28fdbd9',
  'b20b355e-bfcb-4d85-b6e8-80477c1359ed',
  '4e130121-106a-497a-a6f7-552f6babe9ef',
  '02728da7-d75e-4266-a43a-3c665cbf4c62',
  '1f71145d-e13c-4204-ab1f-ced3bd882a07',
  '4f29dcdb-414a-49df-842b-8257b94aefbd',
  'e7bbccf8-db10-4fbb-b937-7811040efe3d',
  '1fe66a42-decc-4b9b-9231-04b9daf6c984',
  '469eaf62-574d-425a-b618-fe300462b45a',
  '8a38c58d-918a-41b6-9d43-a497750aa2ed',
  '2b734775-b046-48f4-9df1-af1befa471a3',
  '43b4b7b6-00ec-4ea5-86d3-b71ff5a2544b',
  '34642ec3-de7b-4481-86c7-0d242f8d601e',
  '5d47e323-beb8-4a6b-8157-3180e7a8f9b5'
);

update meals set effort_level = 2 where id in (
  'b70547e9-e843-4874-870b-feb3ea4ee4a1',
  'fe44fa1f-cb6d-4285-8ded-3b7999d985f1',
  '264a5f1b-8b42-4372-89e4-8c868db048db',
  'cc410d1d-7179-467e-8f8c-e8a08b672911',
  '5cfbdb7b-fd93-43a2-b63d-764a0632eec4',
  '1e7c2f40-fbef-4343-b596-a6c2fe1b62e0',
  '27793daf-1566-4872-9b53-ee50aec33cf1',
  'a2b28b34-2b10-4464-ac17-fb75b5a10a55',
  '5a8e5947-be21-45d5-a0bd-fb326a6b231a',
  'dea7d882-c07b-4955-89a7-e53223f409ce',
  'ced84e06-3125-4073-af25-e60a97624187',
  '7c88b7c3-81af-4907-b862-d1b77e1db083',
  'dd31e58b-e14c-451c-a587-eb426c7934df',
  'eb815635-b133-43b9-b3df-c135a45e5baa',
  '4dd4afd6-9bf0-4398-bd8f-36d838feec5b',
  '0051c5ab-fb3a-4816-bb6f-070d90af7604',
  'f46b251c-30d1-4890-b0ee-5c4ef42d4db4',
  '15994503-9572-4aae-916e-7acd9daf7980',
  '89416468-30b9-49db-9bad-bcc82e1221e5',
  '3ab0b8bb-1206-49b1-87bf-78b575298c44',
  '754d029e-9269-4d24-81ca-4c1edaa149cd',
  '4d18f348-c4c4-425a-b62e-9e4f26c5dffc',
  '0c724688-a824-4c07-aa2e-7ba706da5eb4',
  '1c3e9b32-adbe-47c9-a8f3-f75035b686fc',
  '8b0f0491-dd91-49f3-a5d0-a07f9fafd4ee',
  '3667c70a-918e-4c29-9f9c-c87870e95b2b',
  'e7464b74-ac59-4649-b45c-c516e8266d19',
  'b337d950-0715-4317-bda4-1b889b01eea8'
);

update meals set effort_level = 3 where id in (
  '8191e551-09ad-4ce0-b714-1e18a9da4dab',
  '97534322-fe60-4bbf-81b7-e7098377399f',
  'cab03749-6bfd-42c6-90ec-9d2354983302',
  '72e16c21-02f3-48c0-be56-c1a18ee9b39f',
  'c4a2469f-f144-438e-85c0-053162304d99',
  'fda9afbe-f680-4a31-8747-0d08131840c7',
  '97e47357-dda3-4f5c-8d18-9a06ca7b8884',
  'd6618b65-4e90-4255-9a78-4dd17e5a5e3f',
  'fe2fe84e-3569-4280-89bd-c64e5a4a052c',
  '28098c46-6e3e-4268-9498-014158e7c662',
  'ef036a0b-8cfd-4c9f-87b0-69e53527bcb1',
  '8fbbfd52-a951-4d96-974b-90d341324f3a',
  'ae57f95d-c779-4399-9c03-daaf53dae5b5',
  'f927bc86-61c6-4f2b-8b8e-250144ef8ad6',
  'bdb9ab36-b17d-48ea-abdd-ea0af40ec68e',
  'f34ae5c5-113b-44d5-8dcf-3910363fe941',
  'a8fdbe21-3072-43bc-b489-ecbbc22a7a22',
  '4f055a2c-93b3-4b0e-b8fe-ea98d1d7a5e3',
  '147207a4-5abd-4dcc-9d35-360ef2b7dbbb'
);

-- Phase B -- manual overrides (applied AFTER the bucket update)
update meals set effort_level = 3 where id = '6974286f-f741-4441-a5f3-ee625511e5e3'; -- Chelley's Thai Style Chicken Satay (steps=2)
update meals set effort_level = 1 where id = 'bf2f40ef-8a4a-4b76-98bf-e502ea174286'; -- Garlic Lemon Chili Broccoli (steps=0)
update meals set effort_level = 3 where id = '761c1a24-ee20-4fb3-a862-4f8ca953143d'; -- King Crab Risotto (steps=0)
