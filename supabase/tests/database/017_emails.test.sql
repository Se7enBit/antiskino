-- Email delivery: the stored link token, claiming and finishing emails.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Start from no partners or campings: seed.sql data would skew the results.
-- Everything here is rolled back at the end.
delete from public.campings;
delete from public.partners;
delete from public.notification_queue;

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role": "anon"}'
    else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
end;
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000001', 'owner@test.local', now()),
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now()),
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now());
update public.profiles set locale = 'en' where id = 'a1111111-0000-4000-8000-000000000001';
update public.profiles set locale = 'el' where id = 'a1111111-0000-4000-8000-000000000002';
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff');
insert into public.campings (id, partner_id, slug, status, name, phone, check_in_from)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live',
        'Camping A1', '+30 2310 000000', '14:00');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);

-- 1: booked 10 minutes ago, token stored; 2: booked just now, token not stored yet;
-- 3: booked 10 minutes ago without a token (older bookings have none).
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash, created_at)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1', null, 'Maria',
  'maria' || n || '@test.local', '+30 690 000 0000', 'GR', 'el', '2030-07-10', '2030-07-12', 'tent', '{}', 2,
  'confirmed', 5000, '{}', 'on_site', 'flexible', 600, 300, public.sha256_hex('token-' || n), c
from (values (1, now() - interval '10 minutes'), (2, now()), (3, now() - interval '10 minutes')) v(n, c);

-- The stored token ---------------------------------------------------------------

select public.store_manage_token('b0000000-0000-4000-8000-000000000001', repeat('x', 40));
select public.store_manage_token('b0000000-0000-4000-8000-000000000001', repeat('y', 40));
select is(
  (select manage_token_enc from public.bookings where id = 'b0000000-0000-4000-8000-000000000001'),
  repeat('x', 40),
  'the encrypted link token is stored once'
);

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select throws_ok(
  $$ select manage_token_enc from public.bookings $$, '42501', null, 'users cannot read it'
);
select throws_ok(
  $$ select public.store_manage_token('b0000000-0000-4000-8000-000000000003', repeat('z', 40)) $$,
  '42501', null, '...nor store one'
);
select throws_ok($$ select * from public.claim_email_notifications(1) $$, '42501', null,
  'users cannot claim emails');
select throws_ok($$ select public.finish_notification(1, 'sent') $$, '42501', null,
  '...nor finish them');
reset role;

-- Claiming ------------------------------------------------------------------------

insert into public.notification_queue (kind, booking_id, audience, channel, created_at) values
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'guest', 'email', now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'partner', 'email', now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000002', 'guest', 'email', now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000003', 'guest', 'email', now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'guest', 'push', now()),
  ('booking_cancelled', 'b0000000-0000-4000-8000-000000000001', 'guest', 'email', now() - interval '2 days');
create temp table claimed as select * from public.claim_email_notifications(10);

select results_eq(
  $$ select booking ->> 'ref', audience from claimed order by id $$,
  $$ values ('ANT-AAAAA1', 'guest'), ('ANT-AAAAA1', 'partner'), ('ANT-AAAAA3', 'guest') $$,
  'claims due emails; a new booking''s guest email waits for its link token'
);
select is(
  (select recipients from claimed where audience = 'guest' and booking ->> 'ref' = 'ANT-AAAAA1'),
  '[{"email": "maria1@test.local", "locale": "el"}]'::jsonb,
  'the guest''s address, in the booking''s language'
);
select results_eq(
  $$ select r ->> 'email', r ->> 'locale' from claimed, jsonb_array_elements(recipients) r
     where audience = 'partner' order by 1 $$,
  $$ values ('owner@test.local', 'en'), ('staff@test.local', 'el') $$,
  'the team''s addresses, each in the member''s language'
);
select results_eq(
  $$ select booking ->> 'manage_token_enc', booking -> 'camping' ->> 'name', booking -> 'camping' ->> 'check_in_from',
            booking -> 'pitch_type_name' ->> 'en'
     from claimed where audience = 'guest' and booking ->> 'ref' = 'ANT-AAAAA1' $$,
  $$ values (repeat('x', 40), 'Camping A1', '14:00:00', 'Tent') $$,
  'with what the email shows'
);
select results_eq(
  $$ select status, last_error from public.notification_queue where kind = 'booking_cancelled' $$,
  $$ values ('skipped', 'stale') $$,
  'an email queued over a day ago is skipped'
);
select results_eq(
  $$ select status, attempts from public.notification_queue where channel = 'push' $$,
  $$ values ('pending', 0) $$,
  'pushes are left to the push run'
);
select is_empty($$ select * from public.claim_email_notifications(10) $$, 'claimed emails are leased');

-- Finishing -----------------------------------------------------------------------

select public.finish_notification((select id from claimed where audience = 'partner'), 'sent');
select public.finish_notification(
  (select id from claimed where booking ->> 'ref' = 'ANT-AAAAA3'), 'retry', 'Resend: 429');
select results_eq(
  $$ select q.status, q.sent_at is not null, q.last_error from public.notification_queue q
     where q.id in (select id from claimed where audience = 'partner' or booking ->> 'ref' = 'ANT-AAAAA3')
     order by q.id $$,
  $$ values ('sent', true, null::text), ('pending', false, 'Resend: 429') $$,
  'sent emails are done; failed ones are retried'
);
select public.finish_notification((select id from public.notification_queue where channel = 'push'), 'skipped');
select is(
  (select status from public.notification_queue where channel = 'push'), 'skipped',
  'finish_notification() works for pushes too'
);

select * from finish();
rollback;
