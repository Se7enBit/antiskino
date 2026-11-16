-- campings, the catalog tables, their policies and integrity rules.
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role": "anon"}'
    else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
--   partner A: camping a1 (live), a2 (draft); owner-a, staff-a
--   partner B: camping b1 (draft), b2 (live); owner-b
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local'),
  ('c3333333-0000-4000-8000-000000000001', 'outsider@test.local'),
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
  ('a0000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000000', 'a2', 'draft', 'A2'),
  ('b0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'b1', 'draft', 'B1'),
  ('b0000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-000000000000', 'b2', 'live', 'B2');

insert into public.pitch_types (id, camping_id, name, accepts, max_people, active) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4, true),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Old"}', '{tent}', 4, false),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "B tent"}', '{tent}', 4, true);

insert into public.seasons (id, camping_id, name, dates, min_nights) values
  ('5a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "High"}', '[2027-07-01,2027-09-01)', 3),
  ('5b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "B high"}', '[2027-07-01,2027-09-01)', 1);

insert into public.guest_categories (id, camping_id, name, min_age, max_age) values
  ('ca000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Adult"}', 12, null),
  ('cb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "B adult"}', 12, null);

insert into public.extras (id, camping_id, name, unit, active) values
  ('ea000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Car"}', 'per_night', true),
  ('ea000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Retired"}', 'per_night', false);

insert into public.fees (camping_id, name, unit, amount_cents) values
  ('b0000000-0000-4000-8000-0000000000b1', '{"en": "B fee"}', 'per_stay', 100);

insert into public.prices (season_id, item_type, item_id, amount_cents) values
  ('5a000000-0000-4000-8000-000000000001', 'pitch', 'a1000000-0000-4000-8000-000000000001', 2500),
  ('5a000000-0000-4000-8000-000000000001', 'guest', 'ca000000-0000-4000-8000-000000000001', 800),
  ('5a000000-0000-4000-8000-000000000001', 'extra', 'ea000000-0000-4000-8000-000000000001', 300),
  ('5b000000-0000-4000-8000-000000000001', 'pitch', 'b1000000-0000-4000-8000-000000000001', 2000);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

select has_table('public', 'campings', 'campings exists');
select has_table('public', 'pitch_types', 'pitch_types exists');
select has_table('public', 'prices', 'prices exists');
select is_definer('public', 'set_camping_status', array['uuid', 'camping_status'], 'set_camping_status() is security definer');
select is(
  public.camping_partner('a0000000-0000-4000-8000-0000000000a1'),
  'aaaaaaaa-0000-4000-8000-000000000000'::uuid,
  'camping_partner() returns the owning partner'
);

-- ---------------------------------------------------------------------------
-- anon: live campings and their active catalog only
-- ---------------------------------------------------------------------------

select pg_temp.login(null);
select results_eq(
  'select slug from public.campings order by slug',
  $$ values ('a1'), ('b2') $$,
  'campings_select_live_member_or_admin: anon reads only live campings'
);
select results_eq(
  'select id from public.pitch_types',
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'pitch_types_select: anon reads only active pitch types of live campings'
);
select results_eq(
  'select id from public.extras',
  $$ values ('ea000000-0000-4000-8000-000000000001'::uuid) $$,
  'extras_select: anon reads only active extras of live campings'
);
select is((select count(*)::int from public.seasons), 1, 'seasons_select: anon reads seasons of live campings only');
select is((select count(*)::int from public.guest_categories), 1, 'guest_categories_select: anon reads guest categories of live campings only');
select is_empty('select * from public.fees', 'fees_select: anon reads no fees of draft campings');
select is((select count(*)::int from public.prices), 3, 'prices_select: anon reads prices of live campings only');
select throws_ok(
  $$ insert into public.pitch_types (camping_id, name, accepts, max_people)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "x"}', '{tent}', 2) $$,
  '42501', null,
  'anon cannot write the catalog'
);
select throws_ok(
  $$ select public.set_camping_status('a0000000-0000-4000-8000-0000000000a2', 'live') $$,
  '42501', null,
  'anon cannot call set_camping_status()'
);
reset role;

-- ---------------------------------------------------------------------------
-- Staff of partner A: read everything of A, write nothing
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select results_eq(
  'select slug from public.campings order by slug',
  $$ values ('a1'), ('a2'), ('b2') $$,
  'staff read their partner''s campings in any status, plus live ones'
);
select is(
  (select count(*)::int from public.pitch_types where camping_id = 'a0000000-0000-4000-8000-0000000000a1'),
  2,
  'staff read inactive pitch types of their campings'
);
select throws_ok(
  $$ insert into public.pitch_types (camping_id, name, accepts, max_people)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "x"}', '{tent}', 2) $$,
  '42501', null,
  'pitch_types_write_owner_or_admin: staff cannot add pitch types'
);
select lives_ok(
  $$ update public.campings set name = 'Staff edit' where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  'a staff update of the camping runs without error...'
);
reset role;
select is(
  (select name from public.campings where id = 'a0000000-0000-4000-8000-0000000000a1'),
  'A1',
  '...but campings_update_owner_or_admin kept it unchanged'
);

-- ---------------------------------------------------------------------------
-- Owner of partner A
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is_empty(
  $$ select 1 from public.campings where partner_id = 'bbbbbbbb-0000-4000-8000-000000000000' and status <> 'live'
     union all select 1 from public.pitch_types where camping_id = 'b0000000-0000-4000-8000-0000000000b1'
     union all select 1 from public.seasons where camping_id = 'b0000000-0000-4000-8000-0000000000b1'
     union all select 1 from public.guest_categories where camping_id = 'b0000000-0000-4000-8000-0000000000b1'
     union all select 1 from public.fees where camping_id = 'b0000000-0000-4000-8000-0000000000b1'
     union all select 1 from public.prices where season_id = '5b000000-0000-4000-8000-000000000001' $$,
  'a member of partner A reads no unpublished row of partner B'
);
select lives_ok(
  $$ update public.campings
     set name = 'Camping A1', short_descr = '{"el": "Δίπλα στη θάλασσα", "en": "By the sea"}', amenities = '{wifi,pool}'
     where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  'campings_update_owner_or_admin: the owner edits the camping profile'
);
select throws_ok(
  $$ update public.campings set status = 'live' where id = 'a0000000-0000-4000-8000-0000000000a2' $$,
  '42501', null,
  'the owner cannot publish by updating status'
);
select throws_ok(
  $$ update public.campings set slug = 'mine' where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  '42501', null,
  'the owner cannot change the slug'
);
select throws_ok(
  $$ update public.campings set partner_id = 'bbbbbbbb-0000-4000-8000-000000000000' where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  '42501', null,
  'the owner cannot move a camping to another partner'
);
select throws_ok(
  $$ select public.set_camping_status('a0000000-0000-4000-8000-0000000000a2', 'live') $$,
  '42501', null,
  'the owner cannot call set_camping_status()'
);
select throws_ok(
  $$ update public.campings set payment_mode = 'deposit', deposit_percent = 30
     where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  '23514', null,
  'online payment modes stay off until M7'
);
select throws_ok(
  $$ insert into public.campings (partner_id, slug, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'a3', 'A3') $$,
  '42501', null,
  'campings_insert_admin: owners cannot create campings'
);
select lives_ok(
  $$ insert into public.pitch_types (id, camping_id, name, accepts, max_people, size_m2)
     values ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000a1',
             '{"el": "Τροχόσπιτο", "en": "Caravan"}', '{caravan,camper}', 6, 80) $$,
  'pitch_types_write_owner_or_admin: the owner adds a pitch type'
);
select lives_ok(
  $$ insert into public.seasons (id, camping_id, name, dates)
     values ('5a000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Low"}', '[2027-05-01,2027-07-01)') $$,
  'seasons_write_owner_or_admin: the owner adds a season'
);
select lives_ok(
  $$ insert into public.guest_categories (camping_id, name, min_age, max_age)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "Child"}', 4, 11) $$,
  'guest_categories_write_owner_or_admin: the owner adds a guest category'
);
select lives_ok(
  $$ insert into public.extras (camping_id, name, unit) values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "Pet"}', 'per_night') $$,
  'extras_write_owner_or_admin: the owner adds an extra'
);
select lives_ok(
  $$ insert into public.fees (camping_id, name, unit, amount_cents)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "Local fee"}', 'per_person_night', 50) $$,
  'fees_write_owner_or_admin: the owner adds a fee'
);
select lives_ok(
  $$ insert into public.prices (season_id, item_type, item_id, amount_cents)
     values ('5a000000-0000-4000-8000-000000000002', 'pitch', 'a1000000-0000-4000-8000-000000000003', 3000) $$,
  'prices_write_owner_or_admin: the owner prices a pitch type for a season'
);
select lives_ok(
  $$ update public.prices set amount_cents = 2600
     where season_id = '5a000000-0000-4000-8000-000000000001' and item_type = 'pitch'
       and item_id = 'a1000000-0000-4000-8000-000000000001' $$,
  'the owner changes a price'
);
select throws_ok(
  $$ insert into public.pitch_types (camping_id, name, accepts, max_people)
     values ('b0000000-0000-4000-8000-0000000000b1', '{"en": "x"}', '{tent}', 2) $$,
  '42501', null,
  'the owner cannot add pitch types to another partner''s camping'
);
select throws_ok(
  $$ insert into public.seasons (camping_id, name, dates)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "Overlap"}', '[2027-08-15,2027-09-15)') $$,
  '23P01', null,
  'seasons of a camping cannot overlap'
);
select throws_ok(
  $$ insert into public.guest_categories (camping_id, name, min_age, max_age)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"en": "Teen"}', 10, 15) $$,
  '23P01', null,
  'guest category age ranges cannot overlap'
);
select throws_ok(
  $$ insert into public.prices (season_id, item_type, item_id, amount_cents)
     values ('5a000000-0000-4000-8000-000000000001', 'pitch', 'b1000000-0000-4000-8000-000000000001', 100) $$,
  '23503', null,
  'a price must point at an item of the season''s own camping'
);
select throws_ok(
  $$ insert into public.prices (season_id, item_type, item_id, amount_cents)
     values ('5a000000-0000-4000-8000-000000000001', 'guest', 'a1000000-0000-4000-8000-000000000001', 100) $$,
  '23503', null,
  'a price''s item type must match the item'
);
select throws_ok(
  $$ insert into public.pitch_types (camping_id, name, accepts, max_people)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"de": "Zelt"}', '{tent}', 2) $$,
  '23514', null,
  'translatable text only takes el/en'
);
select throws_ok(
  $$ insert into public.pitch_types (camping_id, name, accepts, max_people)
     values ('a0000000-0000-4000-8000-0000000000a1', '{"el": " ", "en": ""}', '{tent}', 2) $$,
  '23514', null,
  'a pitch type needs a name in at least one language'
);
select lives_ok(
  $$ delete from public.pitch_types where id = 'a1000000-0000-4000-8000-000000000003' $$,
  'the owner deletes a pitch type...'
);
reset role;

select is_empty(
  $$ select 1 from public.prices where item_id = 'a1000000-0000-4000-8000-000000000003' $$,
  '...and its prices go with it'
);
select results_eq(
  $$ select name, short_descr ->> 'el' from public.campings where id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('Camping A1', 'Δίπλα στη θάλασσα') $$,
  'the owner''s profile edit was saved'
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is((select count(*)::int from public.campings), 4, 'an admin reads every camping');
select lives_ok(
  $$ insert into public.campings (partner_id, slug, name) values ('bbbbbbbb-0000-4000-8000-000000000000', 'b3', 'B3') $$,
  'campings_insert_admin: an admin creates a camping'
);
select lives_ok(
  $$ select public.set_camping_status('a0000000-0000-4000-8000-0000000000a2', 'live') $$,
  'an admin publishes a camping'
);
select throws_ok(
  $$ select public.set_camping_status('00000000-0000-4000-8000-000000000000', 'live') $$,
  'P0002', null,
  'set_camping_status() reports an unknown camping'
);
reset role;

select is(
  (select status::text from public.campings where slug = 'a2'),
  'live',
  '...and the camping is live'
);
select is(
  (select status::text from public.campings where slug = 'b3'),
  'draft',
  'new campings start as drafts'
);

select * from finish();
rollback;
