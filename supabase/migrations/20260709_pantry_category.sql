-- Pantry category persistence (P1 foundation).
--
-- Adds a nullable `category` column to pantry_items so a user's move-override
-- (P3) and a future scanned category can persist. Existing rows stay NULL and
-- fall back to the client-side categorize() heuristic — no backfill.
--
-- Also adds an UPDATE RLS policy for a user's own rows, using the verified owner
-- column `user_id`. NOTE: RLS is currently DISABLED on pantry_items (dev; anon
-- GRANT ALL), so this policy is DORMANT scaffolding — it only takes effect if
-- RLS is later enabled (which would also need select/insert/delete policies).
-- Idempotent: column guarded by IF NOT EXISTS, policy by a pg_policies check.

alter table public.pantry_items add column if not exists category text;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pantry_items'
      and policyname = 'pantry_items_update_own'
  ) then
    create policy pantry_items_update_own
      on public.pantry_items
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
