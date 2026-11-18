-- M6 favorites: each user reads and changes only their own; only live campings can be saved.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Start from no partners or campings: seed.sql data would skew the results.
-- Everything here is rolled back at the end.
delete from public.campings;
delete from public.partners;

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role": "anon"}'
    else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
end;
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now()),
  ('f6666666-0000-4000-8000-000000000001', 'other@test.local', now());
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.campings (id, partner_id, slug, status, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1'),
  ('a0000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000000', 'a2', 'draft', 'A2');

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into public.favorites (user_id, camping_id)
     values ('e5555555-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1') $$,
  'a user saves a live camping'
);
select throws_ok(
  $$ insert into public.favorites (user_id, camping_id)
     values ('e5555555-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2') $$,
  '42501', null, '...not a draft one'
);
select throws_ok(
  $$ insert into public.favorites (user_id, camping_id)
     values ('f6666666-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, '...and not for someone else'
);
select results_eq(
  $$ select camping_id::text from public.favorites $$,
  $$ values ('a0000000-0000-4000-8000-0000000000a1') $$,
  'and reads it back'
);
reset role;

select pg_temp.login('f6666666-0000-4000-8000-000000000001');
select is_empty($$ select 1 from public.favorites $$, 'another user does not see it');
delete from public.favorites;
reset role;
select is(
  (select count(*)::integer from public.favorites), 1, '...nor remove it'
);

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
delete from public.favorites where camping_id = 'a0000000-0000-4000-8000-0000000000a1';
select is_empty($$ select 1 from public.favorites $$, 'the user removes it');
select throws_ok(
  $$ update public.favorites set created_at = now() $$, '42501', null, 'favorites are not updated'
);
reset role;

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
insert into public.favorites (user_id, camping_id)
values ('e5555555-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1');
select is(
  public.merge_favorites(array[
    'a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-000000000000'
  ]::uuid[]),
  0,
  'merging the device''s favorites skips duplicates, drafts and unknown campings'
);
reset role;
update public.campings set status = 'live' where id = 'a0000000-0000-4000-8000-0000000000a2';
select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select is(
  public.merge_favorites(array['a0000000-0000-4000-8000-0000000000a2']::uuid[]), 1,
  '...and adds the rest'
);
reset role;

select pg_temp.login(null);
select throws_ok($$ select 1 from public.favorites $$, '42501', null, 'anon has no favorites table');
select throws_ok($$ select public.merge_favorites('{}') $$, '42501', null, 'anon cannot merge favorites');
reset role;

select * from finish();
rollback;
