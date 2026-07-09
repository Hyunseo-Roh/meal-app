-- Account deletion RPC (lightweight; no Edge Function). Deletes all of a user's
-- app data atomically in FK order. Verified FK rules: only pantry_items.user_id
-- is ON DELETE CASCADE; feedback/recommendation_options/recommendation_requests
-- FKs are NO ACTION, so children are deleted first. The auth.users record is
-- left in place (removing it needs service_role) — a documented limitation; the
-- app splash guards the re-login edge. Lockstep with supabase/delete_user_data.sql.

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
