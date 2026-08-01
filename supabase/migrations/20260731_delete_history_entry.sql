-- delete_history_entry(p_request_id): remove ONE made-meal history entry — a
-- recommendation_requests row plus everything that hangs off it — and NOTHING
-- else (never pantry, users, or auth).
--
-- SECURITY DEFINER (bypasses RLS) so every statement is guarded on ownership:
-- the request's user_id must equal auth.uid(). A request id belonging to another
-- user is a silent no-op. search_path='' keeps it injection-safe (all names
-- schema-qualified). Grant to authenticated only.
--
-- FK order into the request: feedback (references both the request and its
-- options) and swap_rejections (references the options, NO ACTION) must go
-- before recommendation_options, which must go before the request itself.
-- swap_rejections is included for the same reason it was added to
-- delete_user_data: without it, deleting an option that a swap points at 409s.
-- Keep in lockstep with supabase/delete_history_entry.sql.

create or replace function public.delete_history_entry(p_request_id uuid)
 returns void
 language sql
 security definer
 set search_path = ''
as $function$
  -- Every delete is gated on the caller owning this request (the request row is
  -- deleted last, so the guard subquery still sees it for the child deletes).
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
