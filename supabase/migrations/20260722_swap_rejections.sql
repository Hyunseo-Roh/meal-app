-- Swap rejections: the light, decaying negative signal from "Not for me" on the
-- Home screen (skimming past a name + photo), kept SEPARATE from post-cook
-- feedback (the heavy, persistent ±20 signal from actually cooking a meal).
--
-- Additive only: a new table + a CREATE OR REPLACE of recommend_meals. Touches
-- none of the 8 existing tables and no enum. RETURNS is unchanged, so no DROP
-- and no client-contract break.
--
-- Weighting (deliberately lighter than cooked feedback's ±20, and decaying):
--   fresh penalty -8 per rejection, linearly to 0 at 21 days (by wall-clock age
--   of created_at), summed per meal and floored at -12. The -12 floor stays
--   clear of the -20 cooked rejection so a stack of skims can never read like
--   one cook-and-disappointed.

begin;

create table if not exists public.swap_rejections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  option_id  uuid not null references public.recommendation_options(id),
  created_at timestamptz not null default now()
);

-- Dev posture matches the rest of the schema (RLS disabled, anon GRANT ALL).
grant all on public.swap_rejections to anon, authenticated, service_role;

create index if not exists swap_rejections_user_idx on public.swap_rejections (user_id);
create index if not exists swap_rejections_option_idx on public.swap_rejections (option_id);

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
    -- Heavy, persistent post-cook signal. Unchanged.
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
  sw as (
    -- Light, decaying swap-rejection signal. -8 fresh, linearly to 0 at 21 days,
    -- summed per meal and floored at -12 (kept clear of the -20 cooked value).
    select o.meal_id,
      greatest(-12, round(sum(
        -8 * greatest(0, 1 - extract(epoch from (now() - sr.created_at)) / (21 * 86400))
      ))::int) as swap_adj
    from swap_rejections sr
    join recommendation_options o on o.id = sr.option_id
    where sr.user_id = p_user_id
    group by o.meal_id
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
      + coalesce((select swap_adj from sw where sw.meal_id = m.id), 0)
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

commit;
