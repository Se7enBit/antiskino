-- A camping's region is a key from the fixed list (campings_region_known), or
-- none; the app shows its name in the reader's language.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- Start from no partners or campings: seed.sql data would skew the results.
-- Everything here is rolled back at the end.
delete from public.campings;
delete from public.partners;

insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.campings (id, partner_id, slug, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'Camping A1');

create function pg_temp.set_region(p_region text) returns void language sql as $$
  update public.campings set region = p_region where id = 'a0000000-0000-4000-8000-0000000000a1';
$$;

select lives_ok($$ select pg_temp.set_region('halkidiki') $$, 'a key from the list is accepted');
select lives_ok($$ select pg_temp.set_region('north-aegean') $$, '...each of them');
select lives_ok($$ select pg_temp.set_region(null) $$, 'no region is accepted');
select throws_ok($$ select pg_temp.set_region('Halkidiki') $$, '23514', null,
  'a name instead of the key is refused');
select throws_ok($$ select pg_temp.set_region('Atlantis') $$, '23514', null,
  'a region not on the list is refused');

select * from finish();
rollback;
