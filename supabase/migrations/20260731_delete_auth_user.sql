-- Account deletion, completed: remove the caller's auth.users identity too, and
-- scope every delete to the CALLER (auth.uid()) rather than a client-supplied id.
--
-- Prior behaviour (20260709_delete_user_data.sql) deleted only the public-schema
-- rows and left auth.users in place, so the email stayed registered: re-signup
-- returned 422 user_already_exists and re-login produced a session with no
-- public.users row that the splash bounced to Welcome. There was no in-app way
-- to reuse a deleted email.
--
-- Fix: keep the same FK-ordered public cleanup, then delete the caller's own
-- auth.users row as the final statement. Deleting from the auth schema needs a
-- privileged role, so the function is now SECURITY DEFINER owned by postgres
-- (verified: postgres holds DELETE on auth.users; every FK referencing
-- auth.users is ON DELETE CASCADE, so the row deletes cleanly).
--
-- SECURITY DEFINER bypasses RLS, so trusting the client-supplied p_user_id would
-- let any caller delete anyone's data once RLS is enabled. So every WHERE now
-- keys off auth.uid() — the JWT caller — and p_user_id is ignored (kept in the
-- signature only so the client rpc('delete_user_data', { p_user_id }) call and
-- its grants are unchanged). With no session, auth.uid() is NULL and every
-- delete is a safe no-op.
--
-- Injection-safe: SET search_path = '' pins an empty path, so every object is
-- schema-qualified (public.*, auth.*, auth.uid()) and no unqualified name can be
-- hijacked.
--
-- Keep in lockstep with supabase/delete_user_data.sql.

create or replace function public.delete_user_data(p_user_id uuid)
 returns void
 language sql
 security definer
 set search_path = ''
as $function$
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

-- SECURITY DEFINER runs as the owner; pin it to postgres, which can delete from
-- auth.users. (create or replace does not change an existing owner, so set it
-- explicitly.)
alter function public.delete_user_data(uuid) owner to postgres;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;
