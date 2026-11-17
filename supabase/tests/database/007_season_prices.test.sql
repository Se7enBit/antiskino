-- set_season_prices().
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Start from no partners or campings: seed.sql data would skew the counts.
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

-- Fixtures: live camping a1 of partner A (owner, staff) with a season, a pitch
-- type, a guest category and an extra; camping b1 of partner B (owner).
insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local');
insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1'),
  ('b0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'b1', 'live', 'B1');
insert into public.seasons (id, camping_id, name, dates) values
  ('5a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "High"}', '[2027-07-01,2027-09-01)');
insert into public.pitch_types (id, camping_id, name, accepts, max_people) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "B tent"}', '{tent}', 4);
insert into public.guest_categories (id, camping_id, name, min_age) values
  ('ca000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Adult"}', 12);
insert into public.extras (id, camping_id, name, unit) values
  ('ea000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Car"}', 'per_night');

select function_returns('public', 'set_season_prices', array['uuid', 'jsonb'], 'integer', 'set_season_prices() returns the number of prices saved');

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is(
  public.set_season_prices('5a000000-0000-4000-8000-000000000001', $$[
    {"item_type": "pitch", "item_id": "a1000000-0000-4000-8000-000000000001", "amount_cents": 1500},
    {"item_type": "guest", "item_id": "ca000000-0000-4000-8000-000000000001", "amount_cents": 800},
    {"item_type": "extra", "item_id": "ea000000-0000-4000-8000-000000000001", "amount_cents": 300}
  ]$$),
  3,
  'the owner saves a season''s prices'
);
select results_eq(
  $$ select item_type::text, amount_cents from public.prices order by amount_cents desc $$,
  $$ values ('pitch', 1500), ('guest', 800), ('extra', 300) $$,
  '...and they are stored'
);
select is(
  public.set_season_prices('5a000000-0000-4000-8000-000000000001', $$[
    {"item_type": "pitch", "item_id": "a1000000-0000-4000-8000-000000000001", "amount_cents": 1600}
  ]$$),
  1,
  'saving again replaces the whole grid'
);
select results_eq(
  $$ select item_type::text, amount_cents from public.prices $$,
  $$ values ('pitch', 1600) $$,
  '...so items left out lose their price'
);
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', $j$[
    {"item_type": "pitch", "item_id": "a1000000-0000-4000-8000-000000000001", "amount_cents": 1700},
    {"item_type": "pitch", "item_id": "b1000000-0000-4000-8000-000000000001", "amount_cents": 100}
  ]$j$) $$,
  '23503', null,
  'an item of another camping is refused'
);
select results_eq(
  $$ select amount_cents from public.prices $$,
  $$ values (1600) $$,
  '...and nothing changes (all or nothing)'
);
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', $j$[
    {"item_type": "pitch", "item_id": "a1000000-0000-4000-8000-000000000001", "amount_cents": -1}
  ]$j$) $$,
  '23514', null,
  'prices cannot be negative'
);
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', '{"pitch": 1}') $$,
  '22023', null,
  'the prices must be a JSON array'
);
select throws_ok(
  $$ select public.set_season_prices('00000000-0000-4000-8000-000000000000', '[]') $$,
  'P0002', null,
  'an unknown season is reported'
);
select is(
  public.set_season_prices('5a000000-0000-4000-8000-000000000001', '[]'),
  0,
  'an empty list clears the season''s prices'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', '[]') $$,
  '42501', null,
  'staff cannot set prices'
);
reset role;

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', '[]') $$,
  '42501', null,
  'another partner cannot set prices'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select public.set_season_prices('5a000000-0000-4000-8000-000000000001', '[]') $$,
  '42501', null,
  'anon cannot call set_season_prices()'
);
reset role;

select * from finish();
rollback;
