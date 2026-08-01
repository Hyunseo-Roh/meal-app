-- Mirror of the live delete_history_entry function (source-of-truth copy, kept
-- in lockstep with supabase/migrations/20260731_delete_history_entry.sql).
--
-- Removes ONE made-meal history entry — a recommendation_requests row plus its
-- feedback, swap_rejections, and recommendation_options — and nothing else
-- (never pantry, users, or auth). SECURITY DEFINER + every statement guarded on
-- the request's user_id = auth.uid(), so another user's request id is a no-op.
-- search_path='' keeps it injection-safe. Grant to authenticated only.

create or replace function public.delete_history_entry(p_request_id uuid)
 returns void
 language sql
 security definer
 set search_path = ''
as $function$
  delete from public.feedback f
   where f.request_id = p_request_id
     and exists (select 1 from public.recommendation_requests r
                 where r.id = p_request_id and r.user_id = auth.uid());

  delete from public.swap_rejections sr
   where sr.option_id in (
           select o.id from public.recommendation_options o where o.request_id = p_request_id)
     and exists (select 1 from public.recommendation_requests r
                 where r.id = p_request_id and r.user_id = auth.uid());

  delete from public.recommendation_options o
   where o.request_id = p_request_id
     and exists (select 1 from public.recommendation_requests r
                 where r.id = p_request_id and r.user_id = auth.uid());

  delete from public.recommendation_requests r
   where r.id = p_request_id and r.user_id = auth.uid();
$function$;

alter function public.delete_history_entry(uuid) owner to postgres;

grant execute on function public.delete_history_entry(uuid) to authenticated;
