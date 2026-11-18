-- M6 reviews: writing, public reading, ratings, replies, moderation, daily guest messages.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

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

-- Fixtures: partner A (owner O, staff S) with live camping A1 and draft camping A2,
-- partner B (owner OB), an admin, guest G and another user X.
insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000001', 'owner@test.local', now()),
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now()),
  ('b2222222-0000-4000-8000-000000000001', 'other-owner@test.local', now()),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local', now()),
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now()),
  ('f6666666-0000-4000-8000-000000000001', 'x@test.local', now());
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
  ('a0000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000000', 'a2', 'draft', 'A2');
insert into public.pitch_types (id, camping_id, name, accepts, max_people) values
  ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4),
  ('c0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a2', '{"en": "Tent"}', '{tent}', 4);

-- 1: G's completed stay at A1; 2: a completed stay at A1 without an account (manage link);
-- 3: G's confirmed stay at A1; 4: G's completed stay at draft A2; 5: G's completed stay at A1;
-- 7: G arrives 10/07/2030; 8: completed 07/07/2030 without an account; 9: completed 07/07/2030, reviewed below.
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  ('a0000000-0000-4000-8000-0000000000' || c)::uuid, ('c0000000-0000-4000-8000-0000000000' || c)::uuid,
  case when u then 'e5555555-0000-4000-8000-000000000001'::uuid end, g, 'guest@test.local',
  '+30 690 000 0000', k, l, a::date, d::date, 'tent', '{}', 2, s::public.booking_status, 5000, '{}',
  'on_site', 'flexible', 600, 300, public.sha256_hex('token-' || n)
from (values
  (1, 'a1', true, ' Maria Papadopoulou', 'GR', 'el', '2026-07-10', '2026-07-12', 'completed'),
  (2, 'a1', false, 'John Smith', 'GB', 'en', '2026-08-03', '2026-08-05', 'completed'),
  (3, 'a1', true, 'Maria Papadopoulou', 'GR', 'el', '2030-08-10', '2030-08-12', 'confirmed'),
  (4, 'a2', true, 'Maria Papadopoulou', 'GR', 'el', '2026-07-01', '2026-07-03', 'completed'),
  (5, 'a1', true, 'Maria Papadopoulou', 'GR', 'el', '2026-06-01', '2026-06-03', 'completed'),
  (7, 'a1', true, 'Maria Papadopoulou', 'GR', 'el', '2030-07-10', '2030-07-12', 'confirmed'),
  (8, 'a1', false, 'John Smith', 'GB', 'en', '2030-07-05', '2030-07-07', 'completed'),
  (9, 'a1', true, 'Maria Papadopoulou', 'GR', 'el', '2030-07-05', '2030-07-07', 'completed')
) v(n, c, u, g, k, l, a, d, s);

-- Writing --------------------------------------------------------------------------

select is(public.can_review('b0000000-0000-4000-8000-000000000001'), true, 'a completed stay can be reviewed');
select is(public.can_review('b0000000-0000-4000-8000-000000000003'), false, 'a stay not yet completed cannot');

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000001', 5, '  Lovely shade.  ') $$,
  'the guest reviews their completed stay'
);
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000001', 4, null) $$,
  'ANT03', null, 'only once per booking'
);
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000003', 4, null) $$,
  'ANT03', null, 'not before the stay is completed'
);
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000005', 6, null) $$,
  '22023', null, 'the rating is 1 to 5'
);
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000005', 3, repeat('x', 1001)) $$,
  '22023', null, 'the text is at most 1000 characters'
);
select throws_ok(
  $$ insert into public.reviews (booking_id, camping_id, rating, locale, author_name, author_country, stay_month)
     values ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-0000000000a1', 5, 'el', 'M', 'GR', '2026-06-01') $$,
  '42501', null, 'no direct writes to reviews'
);
select lives_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000004', 1, null) $$,
  'a stay at a camping that is not live can be reviewed too'
);
reset role;

select results_eq(
  $$ select rating, body, locale, author_name, author_country, stay_month::text, user_id::text, camping_id::text
     from public.reviews where booking_id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values (5, 'Lovely shade.', 'el', 'Maria', 'GR', '2026-07-01',
             'e5555555-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1') $$,
  'the review keeps the first name, country and month of stay'
);
select results_eq(
  $$ select kind, audience, channel from public.notification_queue
     where booking_id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values ('review_received', 'partner', 'push') $$,
  'the camping''s team gets a push'
);

select pg_temp.login('f6666666-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000005', 3, null) $$,
  '42501', null, 'nobody else reviews the guest''s stay'
);
reset role;

select pg_temp.login(null);
select lives_ok(
  $$ select public.guest_submit_review('ant-aaaaa2', 'token-2', 4, '') $$,
  'a guest without an account reviews with the manage link'
);
select throws_ok(
  $$ select public.guest_submit_review('ANT-AAAAA5', 'wrong', 4, null) $$,
  'P0002', null, '...only with the right token'
);
select throws_ok(
  $$ select public.submit_my_review('b0000000-0000-4000-8000-000000000005', 3, null) $$,
  '42501', null, 'anon cannot call submit_my_review()'
);

-- Reading ----------------------------------------------------------------------------

select results_eq(
  $$ select rating, body, author_name, author_country from public.reviews order by rating desc $$,
  $$ values (5, 'Lovely shade.', 'Maria', 'GR'), (4, null, 'John', 'GB') $$,
  'everyone reads the visible reviews of live campings (an empty text is no text)'
);
select throws_ok($$ select user_id from public.reviews $$, '42501', null, 'never who wrote them');
select results_eq(
  $$ select camping_id::text, review_count, rating_avg from public.camping_ratings $$,
  $$ values ('a0000000-0000-4000-8000-0000000000a1', 2, 4.5) $$,
  'the camping rating averages its visible reviews'
);
reset role;

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select results_eq(
  $$ select (b ->> 'can_review')::boolean, (b -> 'review' ->> 'rating')::integer
     from public.my_booking('ANT-AAAAA1') b $$,
  $$ values (false, 5) $$,
  'the guest''s booking shows their review'
);
select results_eq(
  $$ select (b ->> 'can_review')::boolean, b -> 'review' from public.my_booking('ANT-AAAAA5') b $$,
  $$ values (true, 'null'::jsonb) $$,
  '...or that it can be reviewed'
);
reset role;

-- Replies ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.reply_to_review(
       (select id from public.reviews where author_name = 'Maria' and rating = 5), ' Thank you! ') $$,
  'staff reply to a review'
);
select results_eq(
  $$ select partner_reply, partner_replied_at is not null from public.reviews where rating = 5 $$,
  $$ values ('Thank you!', true) $$,
  '...publicly'
);
reset role;

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.reply_to_review('00000000-0000-4000-8000-000000000000', 'x') $$,
  'P0002', null, 'unknown review'
);
reset role;
create temp table t_review as select id from public.reviews where rating = 5;
grant select on t_review to authenticated;
select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.reply_to_review((select id from t_review), 'x') $$,
  '42501', null, 'another partner cannot reply'
);
reset role;
select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.reply_to_review((select id from t_review), 'x') $$,
  '42501', null, 'the guest cannot reply'
);
reset role;

-- Moderation -------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_review_hidden((select id from t_review), true, 'Spam') $$,
  '42501', null, 'owners cannot hide reviews'
);
reset role;

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_review_hidden((select id from t_review), true, ' ') $$,
  '22023', null, 'hiding needs a reason'
);
select lives_ok(
  $$ select public.set_review_hidden((select id from t_review), true, 'Personal data') $$,
  'the admin hides a review'
);
reset role;

select pg_temp.login(null);
select results_eq(
  $$ select rating from public.reviews $$, $$ values (4) $$, 'hidden reviews are not public'
);
select results_eq(
  $$ select review_count, rating_avg from public.camping_ratings $$,
  $$ values (1, 4.0) $$,
  '...and do not count in the rating'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select results_eq(
  $$ select count(*)::integer, count(*) filter (where hidden and hidden_reason = 'Personal data')::integer
     from public.reviews $$,
  $$ values (3, 1) $$,
  'the team sees all its reviews, hidden ones with the reason (and the draft camping''s)'
);
reset role;

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select public.set_review_hidden((select id from t_review), false, null);
reset role;
select results_eq(
  $$ select hidden, hidden_reason from public.reviews where id = (select id from t_review) $$,
  $$ values (false, null::text) $$,
  'the admin shows it again'
);

-- Daily guest messages ---------------------------------------------------------------

insert into public.reviews (booking_id, camping_id, rating, locale, author_name, author_country, stay_month)
values ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-0000000000a1', 5, 'el', 'Maria', 'GR', '2030-07-01');
delete from public.notification_queue;

select is(public.queue_daily_guest_messages('2030-07-08 06:30+00'), 0, 'nothing before 10:00 in Athens');
select is(public.queue_daily_guest_messages('2030-07-08 07:05+00'), 3, 'from 10:00: reminders and invites');
select results_eq(
  $$ select booking_id::text, kind, channel from public.notification_queue order by booking_id, kind, channel $$,
  $$ values
       ('b0000000-0000-4000-8000-000000000007', 'arrival_reminder', 'email'),
       ('b0000000-0000-4000-8000-000000000007', 'arrival_reminder', 'push'),
       ('b0000000-0000-4000-8000-000000000008', 'review_invite', 'email') $$,
  'arrival in 2 days gets a reminder; an unreviewed stay an invite (push only with an account)'
);
select is(public.queue_daily_guest_messages('2030-07-08 08:05+00'), 0, 'each message once');

select results_eq(
  $$ select jobname::text, schedule::text, command::text from cron.job where jobname = 'queue-daily-guest-messages' $$,
  $$ values ('queue-daily-guest-messages', '5 * * * *', 'select public.queue_daily_guest_messages()') $$,
  'the job runs every hour'
);

select * from finish();
rollback;
