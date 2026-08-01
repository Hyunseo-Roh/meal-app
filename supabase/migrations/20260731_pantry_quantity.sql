-- Additive: pantry_items.quantity. NOT NULL DEFAULT 1, so existing rows backfill
-- to 1 and every insert that omits it keeps working unchanged. No column is
-- dropped or altered; no behaviour changes elsewhere. `if not exists` makes this
-- idempotent.

alter table public.pantry_items
  add column if not exists quantity integer not null default 1;
