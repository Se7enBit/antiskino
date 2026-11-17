-- Bookings: creation, transitions, the manage link, partner actions, RLS, claiming and jobs.
begin;
create extension if not exists pgtap with schema extensions;

select plan(65);

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

-- Fixtures:
--   partner A (owner, staff, 5% commission): camping a1 (instant) and a2 (request, 12 h);
--   partner B (owner): camping b1. An admin; guest G (confirmed email); user U (unconfirmed).
--   Each camping: a tent pitch type (4 people) with 1 pitch a night in summer 2030,
--   an adult (12+) and child (0–11) category, a car extra (max 2) and a hidden pet extra.
insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local', now()),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local', now()),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local', now()),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local', now()),
  ('e5555555-0000-4000-8000-000000000001', 'Guest@Test.local', now()),
  ('f6666666-0000-4000-8000-000000000001', 'unconfirmed@test.local', null);
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';
insert into public.partners (id, name, commission_bps) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A', 500),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B', null);
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name, confirmation_mode, request_expiry_hours) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1', 'instant', 24),
  ('a0000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000000', 'a2', 'live', 'A2', 'request', 12),
  ('b0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'b1', 'live', 'B1', 'instant', 24);
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
select ('c0000000-0000-4000-8000-0000000000' || right(c.slug, 2))::uuid, c.id, '{"en": "Tent"}', '{tent}', 4
from public.campings c;
insert into public.seasons (camping_id, name, dates) select id, '{"en": "Summer"}', '[2030-06-01,2030-09-01)' from public.campings;
insert into public.guest_categories (id, camping_id, name, min_age, max_age)
select ('9a000000-0000-4000-8000-0000000000' || right(c.slug, 2))::uuid, c.id, '{"en": "Adult"}'::jsonb, 12, null::int from public.campings c
union all
select ('9c000000-0000-4000-8000-0000000000' || right(c.slug, 2))::uuid, c.id, '{"en": "Child"}', 0, 11 from public.campings c;
insert into public.extras (id, camping_id, name, unit, max_qty, active) values
  ('ea000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Car"}', 'per_night', 2, true),
  ('eb000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Pet"}', 'per_stay', 1, false);
insert into public.inventory_nights (pitch_type_id, night, allotment)
select pt.id, night::date, 1
from public.pitch_types pt
cross join generate_series('2030-07-01'::date, '2030-07-31'::date, interval '1 day') as night;

-- reserve_and_create_booking() with test defaults
create function pg_temp.book(
  p_pitch text, p_arrival date, p_departure date,
  p_party jsonb default null, p_extras jsonb default '{}', p_user uuid default null,
  p_total integer default 12345, p_token text default 'token', p_email text default 'guest@test.local',
  p_equipment public.equipment default 'tent'
) returns table (booking_id uuid, ref text, status public.booking_status, request_expires_at timestamptz)
language sql as $$
  select * from public.reserve_and_create_booking(
    ('c0000000-0000-4000-8000-0000000000' || p_pitch)::uuid, p_arrival, p_departure, p_equipment,
    coalesce(p_party, jsonb_build_object('9a000000-0000-4000-8000-0000000000' || p_pitch, 2)),
    p_extras,
    jsonb_build_object('name', ' Maria P. ', 'email', p_email, 'phone', '+30 690 000 0000',
      'country', 'GR', 'locale', 'el', 'arrival_eta', '15:30', 'note', ''),
    p_user, p_total, '{"lines": []}', public.sha256_hex(p_token)
  );
$$;

create function pg_temp.booked(p_pitch text, p_first date, p_last date) returns int[] language sql as $$
  select array_agg(n.booked order by n.night) from public.inventory_nights n
  where n.pitch_type_id = ('c0000000-0000-4000-8000-0000000000' || p_pitch)::uuid
    and n.night between p_first and p_last;
$$;

-- ---------------------------------------------------------------------------
-- Creating bookings
-- ---------------------------------------------------------------------------

create temp table t_a on commit drop as select * from pg_temp.book('a1', '2030-07-10', '2030-07-12');
grant select on t_a to anon, authenticated;

select ok((select ref ~ '^ANT-[0-9A-HJKMNP-TV-Z]{6}$' from t_a), 'a booking gets an ANT-XXXXXX reference');
select is((select status from t_a), 'confirmed', 'instant campings confirm at once');
select is(pg_temp.booked('a1', '2030-07-09', '2030-07-12'), array[0, 1, 1, 0], 'one pitch is taken for each night of the stay only');
select results_eq(
  $$ select guest_name, guest_email::text, arrival_eta, guest_note, party_size, nights, payment_mode::text,
            cancellation_policy::text, commission_bps, commission_cents, user_id
     from public.bookings where ref = (select ref from t_a) $$,
  $$ values ('Maria P.', 'guest@test.local', '15:30'::time, null::text, 2, 2, 'on_site', 'flexible', 500, 617, null::uuid) $$,
  'the booking keeps the guest details and snapshots policy and commission (5% of 123.45 = 6.17, rounded half up)'
);
select results_eq(
  $$ select actor_kind::text, from_status::text, to_status::text from public.booking_events
     where booking_id = (select booking_id from t_a) $$,
  $$ values ('guest', null::text, 'confirmed') $$,
  'creating writes a booking event'
);
select results_eq(
  $$ select kind, audience, channel from public.notification_queue
     where booking_id = (select booking_id from t_a) order by audience, channel $$,
  $$ values ('booking_confirmed', 'guest', 'email'), ('booking_confirmed', 'partner', 'email'),
            ('booking_confirmed', 'partner', 'push') $$,
  '...and queues the confirmation (no guest push without an account)'
);

create temp table t_b on commit drop as
  select * from pg_temp.book('b1', '2030-07-10', '2030-07-11', p_user => 'e5555555-0000-4000-8000-000000000001', p_total => 10050);
grant select on t_b to authenticated;
select is(
  (select commission_cents from public.bookings where ref = (select ref from t_b)),
  603,
  'without a partner rate the platform default applies (6% of 100.50 = 6.03)'
);
select is(
  (select count(*)::int from public.notification_queue where booking_id = (select booking_id from t_b) and audience = 'guest'),
  2,
  'a guest with an account also gets a push'
);

create temp table t_r on commit drop as select * from pg_temp.book('a2', '2030-07-10', '2030-07-12', p_token => 'token-r');
grant select on t_r to anon, authenticated;
select is((select status from t_r), 'requested', 'request campings create a request');
select ok(
  (select request_expires_at between now() + interval '11 hours 59 minutes' and now() + interval '12 hours 1 minute' from t_r),
  '...answered within the camping''s request hours'
);
select is(pg_temp.booked('a2', '2030-07-10', '2030-07-11'), array[1, 1], 'a request holds its nights');
select results_eq(
  $$ select kind, audience, channel from public.notification_queue
     where booking_id = (select booking_id from t_r) order by audience, channel $$,
  $$ values ('request_received', 'guest', 'email'), ('request_received', 'partner', 'email'),
            ('request_received', 'partner', 'push') $$,
  'a request notifies the guest and the camping'
);

-- the last pitch of 07-11 is taken: a stay over 07-11 is sold out, all or nothing
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-11', '2030-07-13') $$,
  'ANT01', null,
  'a stay with a full night is refused'
);
select is(pg_temp.booked('a1', '2030-07-11', '2030-07-13'), array[1, 0, 0], '...and takes none of its nights');
update public.inventory_nights set closed = true
where pitch_type_id = 'c0000000-0000-4000-8000-0000000000a1' and night = '2030-07-20';
select throws_ok($$ select * from pg_temp.book('a1', '2030-07-19', '2030-07-21') $$, 'ANT01', null, 'closed nights are refused');
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_equipment => 'camper') $$,
  'ANT01', null, 'other equipment is refused'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_party => '{"9a000000-0000-4000-8000-0000000000a1": 5}') $$,
  'ANT01', null, 'a party over max_people is refused'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_party => '{"9a000000-0000-4000-8000-0000000000b1": 2}') $$,
  '22023', null, 'guest categories of another camping are refused'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_party => '{"9a000000-0000-4000-8000-0000000000a1": 0}') $$,
  '22023', null, 'guest counts must be positive'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_extras => '{"ea000000-0000-4000-8000-0000000000a1": 3}') $$,
  '22023', null, 'extras are limited to their maximum'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_extras => '{"eb000000-0000-4000-8000-0000000000a1": 1}') $$,
  '22023', null, 'hidden extras cannot be booked'
);
select lives_ok(
  $$ select * from pg_temp.book('a1', '2030-07-01', '2030-07-02', p_extras => '{"ea000000-0000-4000-8000-0000000000a1": 2}', p_token => 'token-x') $$,
  'extras up to their maximum are fine'
);
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-03', '2030-07-04', p_email => 'not-an-email') $$,
  '23514', null, 'guest details are checked'
);
select throws_ok(
  $$ select * from public.reserve_and_create_booking('00000000-0000-4000-8000-000000000000', '2030-07-03', '2030-07-04', 'tent',
       '{}', '{}', '{}', null, 0, '{}', public.sha256_hex('x')) $$,
  'P0002', null, 'an unknown pitch type is reported'
);

-- ---------------------------------------------------------------------------
-- Transitions
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.transition_booking((select booking_id from t_a), 'declined', 'partner', null, null) $$,
  'ANT02', null, 'a confirmed booking cannot be declined'
);
select throws_ok(
  $$ select public.transition_booking((select booking_id from t_r), 'completed', 'system', null, null) $$,
  'ANT02', null, 'a request cannot be completed'
);

-- ---------------------------------------------------------------------------
-- The manage link
-- ---------------------------------------------------------------------------

select pg_temp.login(null);
select results_eq(
  $$ select g ->> 'ref', g ->> 'status', (g ->> 'can_cancel')::boolean, g -> 'camping' ->> 'name', g -> 'guest' ->> 'name'
     from public.guest_booking(lower((select ref from t_a)), 'token') g $$,
  $$ values ((select ref from t_a), 'confirmed', true, 'A1', 'Maria P.') $$,
  'anon sees a booking with its ref (any case) and token'
);
select is(public.guest_booking((select ref from t_a), 'wrong'), null, 'a wrong token shows nothing');
select is(public.guest_cancel_booking((select ref from t_a), 'token'), 'cancelled'::public.booking_status, 'the guest cancels with the link');
select throws_ok(
  $$ select public.guest_cancel_booking((select ref from t_a), 'token') $$,
  'ANT02', null, '...once'
);
select throws_ok(
  $$ select public.guest_cancel_booking((select ref from t_a), 'wrong') $$,
  'P0002', null, 'a wrong token cannot cancel'
);
select throws_ok($$ select * from public.bookings $$, '42501', null, 'anon cannot read bookings');
select throws_ok(
  $$ select * from pg_temp.book('a1', '2030-07-05', '2030-07-06') $$,
  '42501', null, 'anon cannot call reserve_and_create_booking()'
);
reset role;
select is(pg_temp.booked('a1', '2030-07-10', '2030-07-11'), array[0, 0], 'cancelling gives the nights back');
select results_eq(
  $$ select from_status::text, to_status::text, actor_kind::text from public.booking_events
     where booking_id = (select booking_id from t_a) order by id $$,
  $$ values (null::text, 'confirmed', 'guest'), ('confirmed', 'cancelled', 'guest') $$,
  'each change is an event'
);
select is(
  (select count(*)::int from public.notification_queue where booking_id = (select booking_id from t_a) and kind = 'booking_cancelled'),
  3,
  '...and queues its notifications'
);

-- a stay that already started can't be cancelled by the guest
insert into public.bookings (ref, camping_id, pitch_type_id, guest_name, guest_email, guest_phone, guest_country, locale,
  arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown, payment_mode,
  cancellation_policy, commission_bps, commission_cents, manage_token_hash)
values ('ANT-PAST01', 'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1', 'Past', 'guest@test.local',
  '+30 690 000 0000', 'GR', 'en', current_date - 3, current_date - 1, 'tent', '{}', 1, 'confirmed', 1000, '{}', 'on_site',
  'flexible', 600, 60, public.sha256_hex('past'));
select pg_temp.login(null);
select is(
  (public.guest_booking('ANT-PAST01', 'past') ->> 'can_cancel')::boolean, false, 'past stays show as not cancellable'
);
select throws_ok($$ select public.guest_cancel_booking('ANT-PAST01', 'past') $$, 'ANT02', null, '...and cannot be cancelled');
reset role;

-- ---------------------------------------------------------------------------
-- Partner actions
-- ---------------------------------------------------------------------------

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.partner_booking_action((select booking_id from t_r), 'accept', null) $$,
  '42501', null, 'another partner cannot act on a booking'
);
reset role;
select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(
  public.partner_booking_action((select booking_id from t_r), 'accept', null), 'confirmed'::public.booking_status,
  'staff accept a request'
);
select throws_ok(
  $$ select public.partner_booking_action((select booking_id from t_r), 'decline', null) $$,
  'ANT02', null, 'only requests can be accepted or declined'
);
select throws_ok(
  $$ select public.partner_booking_action((select booking_id from t_r), 'cancel', ' ') $$,
  '22023', null, 'cancelling needs a reason'
);
select throws_ok(
  $$ select public.partner_booking_action((select booking_id from t_r), 'refund', null) $$,
  '22023', null, 'unknown actions are refused'
);
select is(
  public.partner_booking_action((select booking_id from t_r), 'cancel', 'Flooded pitch'), 'cancelled'::public.booking_status,
  'the camping cancels with a reason'
);
reset role;
select is((select cancel_reason from public.bookings where ref = (select ref from t_r)), 'Flooded pitch', 'the reason is kept');
select is(pg_temp.booked('a2', '2030-07-10', '2030-07-11'), array[0, 0], 'the nights are back');
select is(
  (select actor_kind::text from public.booking_events where booking_id = (select booking_id from t_r) and to_status = 'confirmed'),
  'partner', 'the accept is recorded as the partner''s'
);

create temp table t_d on commit drop as select * from pg_temp.book('a2', '2030-07-20', '2030-07-21', p_token => 'token-d');
grant select on t_d to authenticated;
select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is(
  public.partner_booking_action((select booking_id from t_d), 'decline', null), 'declined'::public.booking_status,
  'an admin can decline a request'
);
reset role;
select is(pg_temp.booked('a2', '2030-07-20', '2030-07-20'), array[0], 'declining gives the nights back');

-- ---------------------------------------------------------------------------
-- Reading bookings (RLS)
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from public.bookings),
  5,
  'partner members read their campings'' bookings'
);
select is_empty(
  $$ select 1 from public.bookings where camping_id = 'b0000000-0000-4000-8000-0000000000b1' $$,
  '...but not another partner''s'
);
select ok(
  (select count(*) > 0 from public.booking_events where booking_id = (select booking_id from t_r)),
  'members read the events of their bookings'
);
select is_empty(
  $$ select 1 from public.booking_events where booking_id = (select booking_id from t_b) $$,
  '...but not another partner''s'
);
select throws_ok(
  $$ select manage_token_hash from public.bookings $$,
  '42501', null, 'nobody reads the manage token hash'
);
select throws_ok($$ select * from public.notification_queue $$, '42501', null, 'the notification queue is not readable');
reset role;

-- ---------------------------------------------------------------------------
-- Signed-in guests
-- ---------------------------------------------------------------------------

select pg_temp.login('f6666666-0000-4000-8000-000000000001');
select is(public.claim_bookings(), 0, 'an unconfirmed email claims nothing');
reset role;

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select is(public.claim_bookings(), 5, 'signing in claims the bookings made with that email, in any case');
select is(
  (select count(*)::int from public.bookings),
  6,
  'the guest reads their own bookings (the claimed ones and the one made signed in)'
);
select is(
  public.cancel_my_booking((select booking_id from t_b)), 'cancelled'::public.booking_status,
  'a signed-in guest cancels their booking'
);
reset role;
select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.cancel_my_booking((select booking_id from t_b)) $$,
  'P0002', null, 'nobody cancels someone else''s booking as their own'
);
reset role;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create temp table t_e on commit drop as select * from pg_temp.book('a2', '2030-07-25', '2030-07-27', p_token => 'token-e');
update public.bookings set request_expires_at = now() - interval '1 minute' where id = (select booking_id from t_e);
select is(public.expire_overdue_bookings(), 1, 'overdue requests expire');
select is(
  (select status::text from public.bookings where id = (select booking_id from t_e)), 'expired', '...become expired'
);
select is(pg_temp.booked('a2', '2030-07-25', '2030-07-26'), array[0, 0], '...and give their nights back');
select is(public.complete_past_stays(), 1, 'stays whose departure has passed are completed');
select is((select status::text from public.bookings where ref = 'ANT-PAST01'), 'completed', '...the past one');

select * from finish();
rollback;
