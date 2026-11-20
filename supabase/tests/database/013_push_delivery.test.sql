-- M5 push delivery: expiring-request pushes, claiming and finishing pushes, invoking notify.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

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

-- Fixtures: partner A with an owner (English) and staff (Greek), a guest (English booking).
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
insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'Camping A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[owner]', 'a1111111-0000-4000-8000-000000000001', 'ios'),
  ('ExponentPushToken[staff]', 'a1111111-0000-4000-8000-000000000002', 'android'),
  ('ExponentPushToken[guest]', 'e5555555-0000-4000-8000-000000000001', 'android');

-- 1: the guest's confirmed stay; 2: a request created 5 h ago, expiring in 1 h;
-- 3: a request expiring in 3 h; 4: a request answered within 2 h, expiring in 90 min.
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash, request_expires_at, created_at)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1',
  case when n = 1 then 'e5555555-0000-4000-8000-000000000001'::uuid end, 'Maria',
  -- one email per booking: a guest email holds at most 3 overlapping bookings at a camping
  case when n = 1 then 'guest@test.local' else 'guest' || n || '@test.local' end,
  '+30 690 000 0000', 'GR', 'en', '2030-07-10', '2030-07-12', 'tent', '{}', 2, s::public.booking_status, 5000,
  '{}', 'on_site', 'flexible', 600, 300, public.sha256_hex('token-' || n), e, c
from (values
  (1, 'confirmed', null::timestamptz, now() - interval '1 day'),
  (2, 'requested', now() + interval '1 hour', now() - interval '5 hours'),
  (3, 'requested', now() + interval '3 hours', now() - interval '5 hours'),
  (4, 'requested', now() + interval '90 minutes', now() - interval '30 minutes')
) v(n, s, e, c);

-- Jobs --------------------------------------------------------------------------

select results_eq(
  $$ select jobname::text, schedule::text, command::text from cron.job
     where jobname in ('queue-expiring-requests', 'deliver-push') order by jobname $$,
  $$ values
       ('deliver-push', '* * * * *', 'select public.invoke_notify()'),
       ('queue-expiring-requests', '*/5 * * * *', 'select public.queue_expiring_requests()') $$,
  'pushes go out every minute; expiring requests are checked every 5 minutes'
);

-- queue_expiring_requests ------------------------------------------------------

select is(public.queue_expiring_requests(), 1, 'one request is within 2 hours of its deadline');
select results_eq(
  $$ select booking_id::text, kind, audience, channel from public.notification_queue $$,
  $$ values ('b0000000-0000-4000-8000-000000000002', 'request_expiring', 'partner', 'push') $$,
  '...its team gets a push (not for a request that arrived within 3 hours of its deadline)'
);
select is(public.queue_expiring_requests(), 0, 'only once per request');

-- claim_push_notifications -----------------------------------------------------

insert into public.notification_queue (kind, booking_id, audience, channel, created_at, next_attempt_at) values
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'guest', 'push', now(), now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'partner', 'push', now(), now()),
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'guest', 'email', now(), now()),
  ('booking_cancelled', 'b0000000-0000-4000-8000-000000000001', 'guest', 'push', now() - interval '3 hours', now()),
  ('booking_cancelled', 'b0000000-0000-4000-8000-000000000001', 'partner', 'push', now(), now() + interval '10 minutes');
create temp table claimed as select * from public.claim_push_notifications(10);

select results_eq(
  $$ select kind, audience, attempts, booking ->> 'ref', booking ->> 'camping_name' from claimed order by id $$,
  $$ values
       ('request_expiring', 'partner', 1, 'ANT-AAAAA2', 'Camping A1'),
       ('booking_confirmed', 'guest', 1, 'ANT-AAAAA1', 'Camping A1'),
       ('booking_confirmed', 'partner', 1, 'ANT-AAAAA1', 'Camping A1') $$,
  'claims the due pushes with their booking (not emails, later retries or stale ones)'
);
select is(
  (select recipients from claimed where kind = 'booking_confirmed' and audience = 'guest'),
  '[{"token": "ExponentPushToken[guest]", "locale": "en"}]'::jsonb,
  'the guest''s devices, in the booking''s language'
);
select results_eq(
  $$ select r ->> 'token', r ->> 'locale'
     from claimed, jsonb_array_elements(recipients) r
     where kind = 'booking_confirmed' and audience = 'partner' order by 1 $$,
  $$ values ('ExponentPushToken[owner]', 'en'), ('ExponentPushToken[staff]', 'el') $$,
  'the team''s devices, each in the member''s language'
);
select is(
  (select recipients from claimed where kind = 'request_expiring'),
  (select recipients from claimed where kind = 'booking_confirmed' and audience = 'partner'),
  'the expiring-request push goes to the same team'
);
select is(
  (select booking ->> 'request_expires_at' from claimed where kind = 'request_expiring') is not null,
  true,
  'the claim carries the request deadline'
);
select results_eq(
  $$ select status, last_error from public.notification_queue
     where kind = 'booking_cancelled' and audience = 'guest' $$,
  $$ values ('skipped', 'stale') $$,
  'a push queued over 2 hours ago is skipped'
);
select ok(
  (select bool_and(next_attempt_at >= now() + interval '5 minutes') from public.notification_queue
   where id in (select id from claimed)),
  'claimed pushes are leased for 5 minutes'
);
select is_empty($$ select * from public.claim_push_notifications(10) $$, 'a second run finds nothing due');
select results_eq(
  $$ select status, attempts from public.notification_queue where channel = 'email' $$,
  $$ values ('pending', 0) $$,
  'emails are left for later'
);

-- finish_push_notification -----------------------------------------------------

select public.finish_push_notification(
  (select id from claimed where kind = 'booking_confirmed' and audience = 'guest'), 'sent');
select results_eq(
  $$ select status, sent_at is not null from public.notification_queue
     where kind = 'booking_confirmed' and audience = 'guest' and channel = 'push' $$,
  $$ values ('sent', true) $$,
  'a sent push is done'
);
select public.finish_push_notification(
  (select id from claimed where kind = 'booking_confirmed' and audience = 'partner'), 'retry', 'Expo: 503');
select results_eq(
  $$ select status, last_error from public.notification_queue
     where kind = 'booking_confirmed' and audience = 'partner' $$,
  $$ values ('pending', 'Expo: 503') $$,
  'a failed attempt is retried later'
);
update public.notification_queue set attempts = 5 where kind = 'booking_confirmed' and audience = 'partner';
select public.finish_push_notification(
  (select id from claimed where kind = 'booking_confirmed' and audience = 'partner'), 'retry', 'Expo: 503');
select is(
  (select status from public.notification_queue where kind = 'booking_confirmed' and audience = 'partner'),
  'failed',
  'the fifth failed attempt is final'
);
select public.finish_push_notification((select id from claimed where kind = 'request_expiring'), 'skipped');
select is(
  (select status from public.notification_queue where kind = 'request_expiring'),
  'skipped',
  'a push can be skipped (no device, no longer relevant)'
);
select public.finish_push_notification((select id from claimed where kind = 'request_expiring'), 'sent');
select is(
  (select status from public.notification_queue where kind = 'request_expiring'),
  'skipped',
  'a finished push stays finished'
);

-- forget_push_tokens -----------------------------------------------------------

select is(public.forget_push_tokens(array['ExponentPushToken[guest]', 'ExponentPushToken[nope]']), 1,
  'devices Expo no longer knows are removed');
select is_empty($$ select 1 from public.push_tokens where token = 'ExponentPushToken[guest]' $$, '...gone');

-- invoke_notify ------------------------------------------------------------------

select is(public.invoke_notify(), null, 'nothing due: notify is not called');
update public.notification_queue set next_attempt_at = now() - interval '1 minute'
where kind = 'booking_cancelled' and audience = 'partner';
select is(public.invoke_notify(), null, 'without the Vault secrets notify is not called');
select vault.create_secret('https://example.supabase.co/', 'project_url');
select vault.create_secret('s3cret-value', 'notify_secret');
select isnt(public.invoke_notify(), null, 'with pushes due and the secrets, notify is called');
select results_eq(
  $$ select url, headers ->> 'x-notify-secret' from net.http_request_queue order by id desc limit 1 $$,
  $$ values ('https://example.supabase.co/functions/v1/notify', 's3cret-value') $$,
  '...at the project''s notify function, with the shared secret'
);

-- Privileges ---------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.claim_push_notifications(1) $$, '42501', null,
  'users cannot claim pushes');
select throws_ok($$ select public.invoke_notify() $$, '42501', null, 'users cannot invoke notify');
reset role;

select * from finish();
rollback;
