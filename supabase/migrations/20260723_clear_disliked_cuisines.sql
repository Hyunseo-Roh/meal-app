-- Clear the orphaned users.disliked_cuisine_ids column.
--
-- The cuisine-skip input was removed from both onboarding and the Taste editor,
-- so nothing writes this column anymore, yet recommend_meals still HARD-EXCLUDES
-- meals whose cuisine is in it (recommend_meals.sql line ~118:
--   `where not (m.cuisine_id = any(u.disliked_cuisine_ids))`), and users had no
-- way to clear a value set before the input was removed. Emptying the column
-- makes that `= any(...)` test inert WITHOUT editing recommend_meals (DO NOT
-- TOUCH). Additive/idempotent: re-running is a no-op once all values are '{}'.
--
-- RECOVERABLE DUMP of the 24 non-empty values at migration time
-- (user_id  ->  disliked cuisine labels), captured 2026-07-23 before the UPDATE:
--
--   072510ff-a7cb-46c4-89eb-f7823cb62022  ->  Greek
--   170d630c-6695-4b5d-9ae9-f1bba160c88e  ->  Indian
--   22012568-6426-424f-b4b4-48aed9e56f4c  ->  Indian, Korean
--   23f250e4-9fe8-4b20-ad73-daf895188026  ->  Mexican
--   2b8bee67-1255-4d37-adcc-0a1535b5af3a  ->  Chinese
--   2c2c9564-38ed-4794-9c9c-faecf5a780af  ->  American
--   3048e91e-159f-49e9-9e05-35a866878003  ->  Greek
--   33333333-3333-3333-3333-333333333333  ->  Mexican
--   411986e1-9faf-424a-9b8a-e3824ad72866  ->  Chinese
--   4a52fc42-f76f-4b90-8bca-98df8b53e15b  ->  Greek
--   50b589d9-e789-45e3-b752-a5a1f298dd1e  ->  Greek, Indian, Mexican
--   5984ca69-4b2d-4e4f-a316-3abcfb4d398f  ->  American
--   5d5261ee-f0ac-484a-8d1d-ef9e694a0df8  ->  Indian, Thai, Vietnamese
--   61af6e68-de82-4944-8a17-d44e76792ca4  ->  Japanese, Thai
--   66a10003-6487-4540-b676-8cd261b57879  ->  Indian, Chinese, Mexican
--   7f4c0193-4326-4a64-a0bc-e7545f0c2a94  ->  Chinese, Vietnamese
--   80a99aaf-be45-4097-af16-fc630bae0aa7  ->  Korean
--   92ff80e8-ffc0-4d03-be65-c8c2653673c3  ->  Chinese
--   a1a15038-c848-4031-90fb-f76710d18936  ->  Greek
--   c84d17cb-3ece-41de-bd62-9dbc258aea73  ->  Japanese
--   cb3129dd-42f9-4c0b-b57d-3df49cb58190  ->  Chinese
--   f964ce58-3cb4-4366-8506-3639f206d658  ->  Chinese, Italian
--   fd47cea6-5e15-49f9-8eab-81bf2d775817  ->  Japanese
--   ffbe6278-7767-4e83-8a53-a976d8e6accd  ->  Indian
--
-- Applied 2026-07-23: 24 rows updated.

update users
   set disliked_cuisine_ids = '{}'
 where disliked_cuisine_ids is not null
   and disliked_cuisine_ids <> '{}';
