-- Lightweight account deletion (no Edge Function this session): remove all of a
-- user's app data in one atomic call, in FK order. Only pantry_items.user_id
-- cascades on users delete; every other FK is NO ACTION, so children MUST be
-- deleted first. Order: feedback -> recommendation_options (via the user's
-- requests) -> recommendation_requests -> pantry_items -> users.
--
-- NOTE: the auth.users record is NOT removed here (needs service_role), so the
-- email stays registered. The splash guards the re-login edge (a lingering
-- session whose public.users row is gone routes to Welcome, not onboarding).
--
-- SECURITY INVOKER (default): the caller (anon or authenticated) already holds
-- DELETE on these tables in this dev project. Kept in lockstep with the dated
-- migration supabase/migrations/20260709_delete_user_data.sql.

create or replace function public.delete_user_data(p_user_id uuid)
 returns void
 language sql
as $function$
  delete from feedback where user_id = p_user_id;
  delete from recommendation_options
    where request_id in (select id from recommendation_requests where user_id = p_user_id);
  delete from recommendation_requests where user_id = p_user_id;
  delete from pantry_items where user_id = p_user_id;
  delete from users where id = p_user_id;
$function$;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;
