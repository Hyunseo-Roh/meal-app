-- Account deletion — mirror of the live function. Removes all of a user's app
-- data in FK order, then the caller's own auth.users identity, so a deleted
-- email frees up for re-signup (previously it stayed registered → 422
-- user_already_exists, and re-login left a session with no public.users row).
--
-- SECURITY DEFINER owned by postgres: deleting from auth.users needs a
-- privileged role (postgres holds DELETE on auth.users; every FK referencing
-- auth.users is ON DELETE CASCADE, so the row deletes cleanly). Because DEFINER
-- bypasses RLS, every WHERE keys off auth.uid() — the JWT caller — NOT the
-- client-supplied p_user_id, so it can only ever delete the caller's own rows.
-- p_user_id is kept in the signature (unused) so the client rpc call and grants
-- are unchanged. With no session, auth.uid() is NULL and every delete is a
-- no-op. set search_path = '' pins an empty path (all names schema-qualified),
-- keeping the SECURITY DEFINER function injection-safe.
--
-- Kept in lockstep with the dated migration
-- supabase/migrations/20260731_delete_auth_user.sql.

create or replace function public.delete_user_data(p_user_id uuid)
 returns void
 language sql
 security definer
 set search_path = ''
as $function$
  -- FK-first: swap_rejections reference recommendation_options, so clear them
  -- before the options they point at (else the options delete FK-blocks / 409s).
  delete from public.swap_rejections where user_id = auth.uid();
  delete from public.feedback where user_id = auth.uid();
  delete from public.recommendation_options
    where request_id in (select id from public.recommendation_requests where user_id = auth.uid());
  delete from public.recommendation_requests where user_id = auth.uid();
  delete from public.pantry_items where user_id = auth.uid();
  delete from public.users where id = auth.uid();
  -- Final step: remove the caller's own auth identity so the email frees up.
  -- Cascades to auth.identities / sessions / mfa_factors / one_time_tokens / etc.
  delete from auth.users where id = auth.uid();
$function$;

alter function public.delete_user_data(uuid) owner to postgres;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;
