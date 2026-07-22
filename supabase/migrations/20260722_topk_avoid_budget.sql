-- Top-K per tier + hard avoid exclusion + budget column fix.
--
-- One pass, one migration. Changes vs the rankless version:
--   1. HARD avoid exclusion: meals whose ingredients token-match any of the
--      user's disliked_ingredients are removed entirely (reuses the
--      get_ingredient_gap tokenizer: lower -> split [^a-z]+ -> strip (es|s) ->
--      subset match). Positive-only; NULL/empty avoid list = no effect.
--   2. Budget: read default_budget (what the app writes) before pref_budget.
--      pref_budget is kept as a last-ditch coalesce fallback (always NULL today,
--      nothing writes it) rather than dropped.
--   3. Deterministic ordering: meal_id appended as the final ORDER BY tiebreaker
--      so a session never reshuffles under swap.
--   4. Top-K per tier (K=4): the three SHOWN cards (tier_rank = 0) are resolved
--      FIRST with exactly the previous logic (familiar = top rank; adjacent =
--      highest rank of a different cuisine; stretch = highest score in the
--      bottom two-thirds with a cuisine distinct from both). ONLY THEN are
--      tier_rank 1..3 filled per tier from the remaining pool, so a would-be
--      shown card can never be absorbed into another tier's swap pool.
--   5. Empty-tier fallback: each shown pick re-selects without the distinct-
--      cuisine predicate if it would otherwise be empty, so three tiers always
--      come back.
--   6. One cuisine relabel (data): "Pork Shoulder Tacos ... Greek Yogurt ..."
--      greek -> mexican (unambiguous mislabel).
--
-- RETURNS gains tier_rank (0 = shown card, 1..3 = swap alternates within tier).
-- The argument signature is UNCHANGED (uuid, integer, budget_level, text) so the
-- PostgREST rpc('recommend_meals', ...) call site is unaffected. Kept in lockstep
-- with supabase/recommend_meals.sql.

begin;

drop function if exists public.recommend_meals(uuid, integer, budget_level, text);

create function public.recommend_meals(
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
      -- Rankless favorites: every chosen favorite counts EQUALLY (+30), ceiling +30.
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
        as score
    from meals m
    join cuisines c on c.id = m.cuisine_id
    cross join u
    where not (m.cuisine_id = any(u.disliked_cuisine_ids))
      -- HARD avoid exclusion: drop the meal if ANY avoid term's token set is a
      -- subset of ANY ingredient's token set (same tokenizer as get_ingredient_gap).
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
        order by within_time desc, score desc, cook_time_min asc, est_cost asc, meal_id
      ) as rk
    from scored
  ),
  -- ---- SHOWN picks (tier_rank = 0), resolved first with the previous logic ----
  f0 as (
    select * from ranked order by rk limit 1
  ),
  a0 as (
    select r.* from ranked r
    where r.cuisine_id <> (select cuisine_id from f0)
    order by r.rk limit 1
  ),
  a0f as (
    -- pri sorts the primary pick (a0) ahead of the fallback; the fallback rows
    -- only exist when a0 is empty. ORDER BY references output columns (post-UNION).
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
  -- ---- Swap alternates (tier_rank 1..3), filled AFTER the shown trio is locked ----
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

-- Cuisine relabel: unambiguous mislabel (guarded / idempotent).
update public.meals
set cuisine_id = 'a0000000-0000-0000-0000-000000000002'   -- mexican
where name = 'Pork Shoulder Tacos with Chipotle Greek Yogurt and Coleslaw'
  and cuisine_id = 'a0000000-0000-0000-0000-000000000010'; -- greek

commit;
