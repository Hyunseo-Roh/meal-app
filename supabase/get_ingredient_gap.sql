create function public.get_ingredient_gap(p_user_id uuid, p_meal_id uuid)
 returns table(ingredient text, have boolean, pantry_ids uuid[])
 language sql
 stable
as $function$
  with pantry_tokens as (
    select
      pi.id as pantry_id,
      array(
        select regexp_replace(tok, '(es|s)$', '')
        from regexp_split_to_table(lower(trim(pi.name)), '[^a-z]+') as tok
        where tok <> ''
      ) as toks
    from pantry_items pi
    where pi.user_id = p_user_id
  ),
  recipe as (
    select
      mi.name as ingredient,
      array(
        select regexp_replace(tok, '(es|s)$', '')
        from regexp_split_to_table(lower(trim(mi.name)), '[^a-z]+') as tok
        where tok <> ''
      ) as toks
    from meal_ingredients mi
    where mi.meal_id = p_meal_id
  ),
  matched as (
    select
      r.ingredient,
      pt.pantry_id
    from recipe r
    join pantry_tokens pt
      on cardinality(pt.toks) > 0
     and not exists (
           select 1
           from unnest(pt.toks) as p_tok
           where p_tok <> all (r.toks)
         )
  )
  select
    r.ingredient,
    exists (select 1 from matched m where m.ingredient = r.ingredient) as have,
    coalesce(
      (select array_agg(distinct m.pantry_id) from matched m where m.ingredient = r.ingredient),
      '{}'::uuid[]
    ) as pantry_ids
  from recipe r
  order by have desc, r.ingredient;
$function$;
