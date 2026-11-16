-- inventory_nights, set_allotment() and set_closed().
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

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

-- Fixtures: partner A (owner, staff) with pitch type pa; partner B (owner) with pitch type pb.
insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local'),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local');
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';

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
insert into public.pitch_types (id, camping_id, name, accepts, max_people) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "Tent"}', '{tent}', 4);

-- ---------------------------------------------------------------------------
-- set_allotment
-- ---------------------------------------------------------------------------

select has_table('public', 'inventory_nights', 'inventory_nights exists');
select is_definer('public', 'set_allotment', array['uuid', 'date', 'date', 'integer'], 'set_allotment() is security definer');
select is_definer('public', 'set_closed', array['uuid', 'date', 'date', 'boolean'], 'set_closed() is security definer');

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is(
  public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-10', 5),
  10,
  'the owner sets the allotment for 10 nights (both ends included)'
);
select is(
  public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-05', '2027-07-12', 3),
  8,
  'an overlapping range updates existing nights and adds new ones'
);
select results_eq(
  $$ select night, allotment, booked, closed from public.inventory_nights
     where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' and night in ('2027-07-04', '2027-07-05', '2027-07-12')
     order by night $$,
  $$ values ('2027-07-04'::date, 5, 0, false), ('2027-07-05'::date, 3, 0, false), ('2027-07-12'::date, 3, 0, false) $$,
  'each night keeps its latest allotment and starts unbooked and open'
);
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-10', '2027-07-01', 5) $$,
  '22023', null,
  'the first night must not be after the last night'
);
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-01-01', '2028-02-05', 5) $$,
  '22023', null,
  'at most 400 nights at a time (401 refused)'
);
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', -1) $$,
  '22023', null,
  'the allotment cannot be negative'
);
select throws_ok(
  $$ select public.set_allotment('00000000-0000-4000-8000-000000000000', '2027-07-01', '2027-07-01', 1) $$,
  'P0002', null,
  'an unknown pitch type is reported'
);
select throws_ok(
  $$ select public.set_allotment('b1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', 1) $$,
  '42501', null,
  'the owner of partner A cannot set partner B''s allotment'
);
select throws_ok(
  $$ insert into public.inventory_nights (pitch_type_id, night, allotment)
     values ('a1000000-0000-4000-8000-000000000001', '2027-08-01', 1) $$,
  '42501', null,
  'inventory cannot be inserted directly'
);
select throws_ok(
  $$ update public.inventory_nights set allotment = 99 $$,
  '42501', null,
  'inventory cannot be updated directly'
);
reset role;

-- Simulate bookings on 2027-07-02 (bookings arrive in M4).
update public.inventory_nights set booked = 3
where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' and night = '2027-07-02';

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-03', 2) $$,
  '23514', 'the allotment for 2027-07-02 cannot go below its 3 booked pitches',
  'the allotment never goes below the booked count'
);
select is(
  (select allotment from public.inventory_nights
   where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' and night = '2027-07-01'),
  5,
  '...and a refused change leaves every night untouched'
);
select is(
  public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-03', 3),
  3,
  'the allotment can go down to exactly the booked count'
);
reset role;

-- staff and others
select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', 9) $$,
  '42501', null,
  'staff cannot set the allotment'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select public.set_allotment('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', 9) $$,
  '42501', null,
  'anon cannot call set_allotment()'
);
select throws_ok('select * from public.inventory_nights', '42501', null, 'anon cannot read inventory');
reset role;

-- ---------------------------------------------------------------------------
-- set_closed
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(
  public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-03', true),
  3,
  'staff close nights (stop-sell)'
);
select is(
  public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-04', true),
  1,
  'closing again only counts nights that changed'
);
select is(
  public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-08-01', '2027-08-05', true),
  0,
  'nights without inventory are skipped'
);
select is(
  public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-07-03', '2027-07-03', false),
  1,
  'staff reopen a night'
);
select is(
  (select count(*)::int from public.inventory_nights),
  12,
  'inventory_nights_select_member_or_admin: staff read their camping''s inventory'
);
reset role;

select results_eq(
  $$ select night, closed from public.inventory_nights
     where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' and night between '2027-07-01' and '2027-07-05'
     order by night $$,
  $$ values ('2027-07-01'::date, true), ('2027-07-02'::date, true), ('2027-07-03'::date, false),
            ('2027-07-04'::date, true), ('2027-07-05'::date, false) $$,
  'closed flags are saved per night'
);

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', false) $$,
  '42501', null,
  'another partner cannot open or close nights'
);
select is_empty(
  $$ select 1 from public.inventory_nights where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'another partner reads none of the inventory'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select public.set_closed('a1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-01', false) $$,
  '42501', null,
  'anon cannot call set_closed()'
);
reset role;

-- ---------------------------------------------------------------------------
-- Admin and constraints
-- ---------------------------------------------------------------------------

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is(
  public.set_allotment('b1000000-0000-4000-8000-000000000001', '2027-07-01', '2027-07-02', 4),
  2,
  'an admin can set any allotment'
);
select is((select count(*)::int from public.inventory_nights), 14, 'an admin reads all inventory');
reset role;

select throws_ok(
  $$ update public.inventory_nights set booked = allotment + 1
     where pitch_type_id = 'b1000000-0000-4000-8000-000000000001' and night = '2027-07-01' $$,
  '23514', null,
  'booked can never exceed the allotment'
);
select throws_ok(
  $$ update public.inventory_nights set allotment = -1
     where pitch_type_id = 'b1000000-0000-4000-8000-000000000001' and night = '2027-07-01' $$,
  '23514', null,
  'allotment cannot be negative'
);
select is(
  (select count(*)::int from public.inventory_nights where pitch_type_id = 'a1000000-0000-4000-8000-000000000001'),
  12,
  'nights are unique per pitch type'
);

select * from finish();
rollback;
