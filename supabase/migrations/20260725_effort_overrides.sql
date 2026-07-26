-- Effort overrides (additive) — three dishes the step-count migration
-- (20260725_effort_from_steps.sql) dropped to effort 1 only because their
-- instruction arrays are under-seeded/terse. They are genuinely involved, so
-- override by hand. Data only — no schema, no RPC. Reversible via the dump below.
--
-- RECOVERABLE BEFORE-STATE (id  old -> new  name), 2026-07-25:
--   d42222a4-27b5-4d1e-8f54-f785761177d6  old=1 -> new=3  Eggplant Parmesan
--   1fe66a42-decc-4b9b-9231-04b9daf6c984  old=1 -> new=3  Moussaka With Portabella
--   469eaf62-574d-425a-b618-fe300462b45a  old=1 -> new=2  Palak Paneer

update meals set effort_level = 3 where id = 'd42222a4-27b5-4d1e-8f54-f785761177d6'; -- Eggplant Parmesan (was 1)
update meals set effort_level = 3 where id = '1fe66a42-decc-4b9b-9231-04b9daf6c984'; -- Moussaka With Portabella (was 1)
update meals set effort_level = 2 where id = '469eaf62-574d-425a-b618-fe300462b45a'; -- Palak Paneer (was 1)
