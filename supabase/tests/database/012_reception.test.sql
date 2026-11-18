-- M5 reception: check-in / no-show, the desk fields, Realtime, push tokens.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

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

-- Fixtures: partner A (staff S) with camping A1, partner B (owner O), a guest G.
insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now()),
  ('b2222222-0000-4000-8000-000000000001', 'other@test.local', now()),
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now());
insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);

-- 1: confirmed, arrives today; 2: confirmed, arrives today; 3: confirmed, arrives
-- in 5 days; 4: a request arriving today.
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash, request_expires_at)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1',
  'e5555555-0000-4000-8000-000000000001', 'Guest', 'guest@test.local', '+30 690 000 0000', 'GR', 'en',
  public.athens_today() + d, public.athens_today() + d + 2, 'tent', '{}', 2, s::public.booking_status, 5000, '{}',
  'on_site', 'flexible', 600, 300, public.sha256_hex('token-' || n),
  case when s = 'requested' then now() + interval '1 day' end
from (values (1, 0, 'confirmed'), (2, 0, 'confirmed'), (3, 5, 'confirmed'), (4, 0, 'requested')) v(n, d, s);

-- check_in / no_show ---------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(
  public.partner_booking_action('b0000000-0000-4000-8000-000000000001', 'check_in', null),
  'checked_in'::public.booking_status,
  'staff check in a confirmed guest on the arrival day'
);
select is(
  public.partner_booking_action('b0000000-0000-4000-8000-000000000002', 'no_show', null),
  'no_show'::public.booking_status,
  'staff mark a confirmed guest who did not come as no-show'
);
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000003', 'check_in', null) $$,
  'ANT02', 'not before the arrival day', 'no check-in before the arrival day'
);
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000003', 'no_show', null) $$,
  'ANT02', 'not before the arrival day', 'no no-show before the arrival day'
);
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000004', 'check_in', null) $$,
  'ANT02', null, 'a request cannot be checked in'
);
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000001', 'check_in', null) $$,
  'ANT02', null, 'a checked-in guest cannot be checked in again'
);
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000002', 'cancel', 'Changed plans') $$,
  'ANT02', null, 'a no-show cannot be cancelled'
);
reset role;

select results_eq(
  $$ select booking_id::text, from_status::text, to_status::text, actor_kind::text, actor_user_id::text
     from public.booking_events
     where booking_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')
     order by booking_id $$,
  $$ values
       ('b0000000-0000-4000-8000-000000000001', 'confirmed', 'checked_in', 'partner', 'a1111111-0000-4000-8000-000000000002'),
       ('b0000000-0000-4000-8000-000000000002', 'confirmed', 'no_show', 'partner', 'a1111111-0000-4000-8000-000000000002') $$,
  'check-in and no-show are recorded in the timeline'
);

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000003', 'check_in', null) $$,
  '42501', null, 'another partner cannot check guests in'
);
reset role;

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000003', 'no_show', null) $$,
  '42501', null, 'the guest cannot mark a no-show'
);
reset role;

-- update_booking_desk ----------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-000000000003', ' B12 ', ' Arrives late ') $$,
  'staff set the assigned pitch and the internal note'
);
select results_eq(
  $$ select assigned_pitch, internal_note from public.bookings where id = 'b0000000-0000-4000-8000-000000000003' $$,
  $$ values ('B12', 'Arrives late') $$,
  '...trimmed'
);
select lives_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-000000000003', 'B12', '') $$,
  'empty text clears a field'
);
select results_eq(
  $$ select assigned_pitch, internal_note from public.bookings where id = 'b0000000-0000-4000-8000-000000000003' $$,
  $$ values ('B12', null::text) $$,
  '...and keeps the other'
);
select throws_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-000000000003', repeat('x', 41), null) $$,
  '23514', null, 'a pitch label is at most 40 characters'
);
select throws_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-0000000000ff', 'B12', null) $$,
  'P0002', null, 'unknown booking'
);
reset role;

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-000000000003', 'C1', null) $$,
  '42501', null, 'another partner cannot edit the desk fields'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select public.update_booking_desk('b0000000-0000-4000-8000-000000000003', 'C1', null) $$,
  '42501', null, 'anon cannot call update_booking_desk()'
);
reset role;

-- Realtime ---------------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'),
  'bookings are published to Realtime'
);

-- Push tokens ------------------------------------------------------------------

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[device-1]', 'android') $$,
  'a signed-in user registers a device'
);
select results_eq(
  $$ select token, platform from public.push_tokens $$,
  $$ values ('ExponentPushToken[device-1]', 'android') $$,
  '...and sees it'
);
select throws_ok(
  $$ insert into public.push_tokens (token, user_id, platform)
     values ('ExponentPushToken[device-2]', 'e5555555-0000-4000-8000-000000000001', 'ios') $$,
  '42501', null, 'no direct writes to push_tokens'
);
reset role;

-- The device changes hands: it moves to the new user, and the old one cannot remove it.
select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select public.register_push_token('ExponentPushToken[device-1]', 'ios');
reset role;
select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select public.unregister_push_token('ExponentPushToken[device-1]');
select is_empty($$ select 1 from public.push_tokens $$, 'the previous user no longer sees the device');
reset role;
select results_eq(
  $$ select user_id::text, platform from public.push_tokens where token = 'ExponentPushToken[device-1]' $$,
  $$ values ('b2222222-0000-4000-8000-000000000001', 'ios') $$,
  'the device belongs to the new user'
);

select pg_temp.login(null);
select throws_ok(
  $$ select public.register_push_token('ExponentPushToken[device-3]', 'ios') $$,
  '42501', null, 'anon cannot register a device'
);
reset role;

select * from finish();
rollback;
