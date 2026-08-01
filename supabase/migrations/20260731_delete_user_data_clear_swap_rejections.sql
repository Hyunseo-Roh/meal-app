-- delete_user_data: clear swap_rejections too, so deletion no longer 409s for
-- anyone who used "Not for me".
--
-- swap_rejections.option_id references recommendation_options(id) with NO ACTION,
-- and the function deleted recommendation_options without first clearing the
-- swap_rejections that point at them — so any user with a recorded swap could
-- not be deleted (FK violation → 409). Fix: delete the caller's swap_rejections
-- FIRST (the table has user_id, scoped to auth.uid()), before recommendation_
-- options. Everything else is byte-identical to the prior version: SECURITY
-- DEFINER, owner postgres, search_path='', all deletes on auth.uid(), and the
-- final auth.users delete. Keep in lockstep with supabase/delete_user_data.sql.

create or replace function public.delete_user_data(p_user_id uuid)
 returns void
 language sql
 security definer
 set search_path = ''
as $function$
  -- FK-first: swap_rejections reference recommendation_options, so clear them
  -- before the options they point at (else the options delete FK-blocks).
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
