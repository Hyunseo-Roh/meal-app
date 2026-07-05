alter table users add column if not exists pref_cuisine_ids uuid[];
update users
set pref_cuisine_ids = array[pref_cuisine_id]
where pref_cuisine_id is not null
  and (pref_cuisine_ids is null or pref_cuisine_ids = '{}');
