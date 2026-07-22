-- Time becomes a soft preference instead of a hard primary sort.
--
-- Previously the ranked CTE ordered by `within_time DESC` first, which made a
-- 15-minute request pin the familiar card to the single <=15-min meal in the
-- catalog regardless of taste/budget/score. This removes within_time from the
-- ORDER BY entirely and instead folds a linear over-time penalty into `score`:
--
--   penalty = least(60, round(1.5 * minutes_over))   -- capped at -60
--
-- -1.5 points per minute over the requested time. The -60 cap is deliberately
-- high (reached at 40 min over) so it does not reintroduce a binary-time cliff.
-- When p_time_available is null there is no penalty at all. `over_time` is kept
-- exactly as before (not within_time) as an honest display flag only.
--
-- RETURNS is UNCHANGED (still includes tier_rank), so this is a plain
-- CREATE OR REPLACE: no DROP, no argument-signature change, no client change,
-- and no window where prod runs a mismatched function/client pair. Kept in
-- lockstep with supabase/recommend_meals.sql.

create or replace function public.recommend_meals(
  p_user_id uuid,
  p_time_available integer default null,
  p_budget budget_level default null,
  p_mood text default null
)
returns table(
  tier text, tier_rank integer, meal_id uuid, meal text, cuisine text,
  effort_level bigint, est_cost numeric, cook_time_min bigint,
  over_time boolean, score integer
)
language sql
stable
as $function$
  with u as (
    select
      id, pref_cuisine_id,
      coalesce(pref_effort, 2)                                   as pref_effort,
      coalesce(p_budget, default_budget, pref_budget, 'medium')  as eff_budget,
      coalesce(disliked_cuisine_ids, '{}')                       as disliked_cuisine_ids,
      coalesce(disliked_ingredients, '{}')                       as avoid_terms,
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
      + case lower(coalesce(p_mood, ''))
          when 'tired'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          when 'quick'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          when 'light'  then case when m.effort_level = 1 then 18 when m.effort_level = 2 then 8 else 0 end
          when 'comfort' then case when m.cuisine_id = any(u.fav_ids) then 12 else 0 end
          when 'adventurous' then case when u.fav_ids = '{}'::uuid[] or not (m.cuisine_id = any(u.fav_ids)) then 14 else 0 end
          else 0
        end
      -- Soft over-time penalty: -1.5 pts/min over the requested time, capped -60.
      -- No time requested => no penalty (greatest(0, 0)).
      - least(60, round(1.5 * greatest(0,
          case when p_time_available is null then 0 else m.cook_time_min - p_time_available end
        )))::int
        as score
    from meals m
    join cuisines c on c.id = m.cuisine_id
    cross join u
    where not (m.cuisine_id = any(u.disliked_cuisine_ids))
      and not exists (
        select 1
        from unnest(u.avoid_terms) as av(term)
        cross join lateral (
          select array(
            select regexp_replace(tok, '(es|s)$', '')
            from regexp_split_to_table(lower(trim(av.term)), '[^a-z]+') as tok
            where tok <> ''
          ) as atoks
        ) a
        where cardinality(a.atoks) > 0
          and exists (
            select 1 from meal_ingredients mi
            where mi.meal_id = m.id
              and not exists (
                select 1 from unnest(a.atoks) as at(t)
                where at.t <> all (
                  array(
                    select regexp_replace(tok, '(es|s)$', '')
                    from regexp_split_to_table(lower(trim(mi.name)), '[^a-z]+') as tok
                    where tok <> ''
                  )
                )
              )
          )
      )
  ),
  ranked as (
    -- within_time removed from the ordering; time now lives in `score` as a
    -- penalty. meal_id keeps ordering deterministic.
    select *,
      row_number() over (
        order by score desc, cook_time_min asc, est_cost asc, meal_id
      ) as rk
    from scored
  ),
  f0 as (
    select * from ranked order by rk limit 1
  ),
  a0 as (
    select r.* from ranked r
    where r.cuisine_id <> (select cuisine_id from f0)
    order by r.rk limit 1
  ),
  a0f as (
    select meal_id, meal, cuisine, cuisine_id, effort_level, est_cost,
           cook_time_min, within_time, score, rk
    from (
      select aa.*, 1 as pri from a0 aa
      union all
      select r.*, 2 as pri from ranked r
      where not exists (select 1 from a0)
        and r.meal_id <> (select meal_id from f0)
    ) x
    order by pri, rk
    limit 1
  ),
  s0 as (
    select r.* from ranked r
    where r.cuisine_id <> (select cuisine_id from f0)
      and r.cuisine_id <> (select cuisine_id from a0f)
      and r.rk > (select count(*) from ranked) / 3
    order by r.score desc, r.est_cost asc, r.meal_id limit 1
  ),
  s0f as (
    select meal_id, meal, cuisine, cuisine_id, effort_level, est_cost,
           cook_time_min, within_time, score, rk
    from (
      select ss.*, 1 as pri from s0 ss
      union all
      select r.*, 2 as pri from ranked r
      where not exists (select 1 from s0)
        and r.meal_id <> (select meal_id from f0)
        and r.meal_id <> (select meal_id from a0f)
    ) x
    order by pri, score desc, est_cost asc, meal_id
    limit 1
  ),
  shown as (
    select meal_id from f0
    union select meal_id from a0f
    union select meal_id from s0f
  ),
  fam_alt as (
    select r.* from ranked r
    where r.meal_id not in (select meal_id from shown)
    order by r.rk limit 3
  ),
  adj_alt as (
    select r.* from ranked r
    where r.meal_id not in (select meal_id from shown)
      and r.meal_id not in (select meal_id from fam_alt)
      and r.cuisine_id <> (select cuisine_id from f0)
    order by r.rk limit 3
  ),
  str_alt as (
    select r.* from ranked r
    where r.meal_id not in (select meal_id from shown)
      and r.meal_id not in (select meal_id from fam_alt)
      and r.meal_id not in (select meal_id from adj_alt)
      and r.rk > (select count(*) from ranked) / 3
      and r.cuisine_id <> (select cuisine_id from f0)
      and r.cuisine_id <> (select cuisine_id from a0f)
    order by r.score desc, r.est_cost asc, r.meal_id limit 3
  ),
  out_rows as (
    select 'familiar'::text as tier, 0 as tier_rank, meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from f0
    union all
    select 'familiar', row_number() over (order by rk), meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from fam_alt
    union all
    select 'adjacent', 0, meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from a0f
    union all
    select 'adjacent', row_number() over (order by rk), meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from adj_alt
    union all
    select 'stretch', 0, meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from s0f
    union all
    select 'stretch', row_number() over (order by score desc, est_cost asc, meal_id), meal_id, meal, cuisine, effort_level, est_cost, cook_time_min, within_time, score from str_alt
  )
  select tier, tier_rank::int, meal_id, meal, cuisine,
         effort_level, est_cost, cook_time_min,
         not within_time as over_time, score::int
  from out_rows
  order by
    case tier when 'familiar' then 0 when 'adjacent' then 1 else 2 end,
    tier_rank;
$function$;
