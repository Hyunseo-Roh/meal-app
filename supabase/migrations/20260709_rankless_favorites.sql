-- Rankless favorites (professor feedback: do not force users to rank cuisines).
--
-- Flattens the recommend_meals cuisine term from the 30/20/10 rank weighting to
-- a single +30 for ANY chosen favorite (per-meal membership, so the Taste
-- ceiling stays +30 — overall balance vs. the other terms is unchanged). Mood
-- comfort/adventurous are made rankless too (was keyed off fav_ids[1], the old
-- rank-1 element). The Familiar/Adjacent/Stretch selection CTEs are unchanged.
--
-- Reads pref_cuisine_ids (array) as an UNORDERED set; pref_cuisine_id (scalar)
-- is still written by the app as "any one chosen" so isOnboarded() and the
-- reasons text keep working. Kept in lockstep with supabase/recommend_meals.sql.

CREATE OR REPLACE FUNCTION public.recommend_meals(p_user_id uuid, p_time_available integer DEFAULT NULL::integer, p_budget budget_level DEFAULT NULL::budget_level, p_mood text DEFAULT NULL::text)
 RETURNS TABLE(tier text, meal_id uuid, meal text, cuisine text, effort_level bigint, est_cost numeric, cook_time_min bigint, over_time boolean, score integer)
 LANGUAGE sql
 STABLE
AS $function$
  with u as (
    select
      id, pref_cuisine_id,
      coalesce(pref_effort, 2)                  as pref_effort,
      coalesce(p_budget, pref_budget, 'medium') as eff_budget,
      coalesce(disliked_cuisine_ids, '{}')      as disliked_cuisine_ids,
      -- Chosen favorites (UNORDERED — no rank). Prefer the array, fall back to
      -- the single pref_cuisine_id scalar so nothing breaks pre-migration.
      coalesce(
        nullif(pref_cuisine_ids, '{}'::uuid[]),
        case when pref_cuisine_id is not null
             then array[pref_cuisine_id] else '{}'::uuid[] end
      ) as fav_ids
    from users where id = p_user_id
  ),
  fb as (
    select
      o.meal_id,
      case f.rating
        when 'loved_it'   then 20
        when 'not_for_me' then -20
        else 0
      end as feedback_adj
    from feedback f
    join recommendation_options o on o.id = f.option_id
    where f.user_id = p_user_id
  ),
  pantry as (
    select rtrim(lower(trim(name)), 's') as p
    from pantry_items
    where user_id = p_user_id
  ),
  pb as (
    select mi.meal_id, 15 as pantry_bonus
    from meal_ingredients mi
    where exists (
      select 1 from pantry pt
      where position(pt.p in rtrim(lower(trim(mi.name)), 's')) > 0
         or position(rtrim(lower(trim(mi.name)), 's') in pt.p) > 0
    )
    group by mi.meal_id
  ),
  scored as (
    select
      m.id as meal_id, m.name as meal, c.name as cuisine,
      m.cuisine_id, m.effort_level, m.est_cost, m.cook_time_min,
      (p_time_available is null or m.cook_time_min <= p_time_available) as within_time,
      greatest(0, 30 - abs(m.effort_level - u.pref_effort) * 15)
      -- Rankless favorites: every chosen favorite counts EQUALLY. The term is
      -- per-meal membership, so the Taste ceiling stays +30 (removed the forced
      -- 30/20/10 ranking per professor feedback).
      + case when m.cuisine_id = any(u.fav_ids) then 30 else 0 end
      + case
          when u.eff_budget = 'high' then 20
          when u.eff_budget = 'medium' and m.est_cost <= 4.00 then 20
          when u.eff_budget = 'medium' then 8
          when u.eff_budget = 'low' and m.est_cost <= 2.50 then 20
          when u.eff_budget = 'low' and m.est_cost <= 4.00 then 8
          else 0
        end
      + coalesce((select sum(feedback_adj) from fb where fb.meal_id = m.id), 0)
      + coalesce((select pantry_bonus from pb where pb.meal_id = m.id), 0)
      -- mood adjustment (can flip rank; cuisine term untouched so taste stays primary; NULL mood = no effect)
      + case lower(coalesce(p_mood, ''))
          when 'tired'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          when 'quick'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          when 'light'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          -- Rankless: comfort favors ANY favorite; adventurous favors non-favorites.
          when 'comfort' then case when m.cuisine_id = any(u.fav_ids) then 12 else 0 end
          when 'adventurous' then case when u.fav_ids = '{}'::uuid[] or not (m.cuisine_id = any(u.fav_ids)) then 14 else 0 end
          else 0
        end
        as score
    from meals m
    join cuisines c on c.id = m.cuisine_id
    cross join u
    where not (m.cuisine_id = any(u.disliked_cuisine_ids))
  ),
  ranked as (
    select *,
      row_number() over (
        order by within_time desc, score desc, cook_time_min asc, est_cost asc
      ) as rk
    from scored
  ),
  familiar as (
    select * from ranked order by rk limit 1
  ),
  adjacent as (
    select r.* from ranked r, familiar f
    where r.cuisine_id <> f.cuisine_id
    order by r.rk limit 1
  ),
  stretch as (
    select r.* from ranked r, familiar f, adjacent a
    where r.cuisine_id <> f.cuisine_id and r.cuisine_id <> a.cuisine_id
      and r.rk > (select count(*) from ranked) / 3
    order by r.score desc, r.est_cost asc limit 1
  )
  select 'familiar'::text, meal_id, meal, cuisine, effort_level, est_cost,
         cook_time_min, not within_time as over_time, score::int from familiar
  union all
  select 'adjacent', meal_id, meal, cuisine, effort_level, est_cost,
         cook_time_min, not within_time, score::int from adjacent
  union all
  select 'stretch', meal_id, meal, cuisine, effort_level, est_cost,
         cook_time_min, not within_time, score::int from stretch;
$function$;
