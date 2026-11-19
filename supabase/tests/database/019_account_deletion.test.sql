-- Account deletion: bookings anonymized, reviews removed, last owners kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

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
  ('e5555555-0000-4000-8000-000000000001', 'Maria@Test.local', now()),
  ('f6666666-0000-4000-8000-000000000001', 'other@test.local', now());
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);

-- 1: Maria's booking (linked); 2: booked with her email before she had an account; 3: someone else's.
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, vehicle_plate, guest_note, arrival, departure, equipment, party, party_size, status,
  total_cents, price_breakdown, payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1', u, nm, em,
  '+30 690 000 0000', 'GR', 'el', 'ABC 1234', 'Late', '2030-07-10', '2030-07-12', 'tent', '{}', 2,
  'completed', 5000, '{}', 'on_site', 'flexible', 600, 300, public.sha256_hex('t' || n)
from (values
  (1, 'e5555555-0000-4000-8000-000000000001'::uuid, 'Maria P.', 'maria@test.local'),
  (2, null::uuid, 'Maria P.', 'MARIA@test.local'),
  (3, 'f6666666-0000-4000-8000-000000000001'::uuid, 'John', 'other@test.local')
) v(n, u, nm, em);
insert into public.reviews (booking_id, camping_id, user_id, rating, locale, author_name, author_country, stay_month)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1',
        'e5555555-0000-4000-8000-000000000001', 5, 'el', 'Maria', 'GR', '2030-07-01');
insert into public.notification_queue (kind, booking_id, audience, channel) values
  ('review_invite', 'b0000000-0000-4000-8000-000000000002', 'guest', 'email'),
  ('booking_cancelled', 'b0000000-0000-4000-8000-000000000001', 'partner', 'email');

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.prepare_account_deletion('e5555555-0000-4000-8000-000000000001') $$,
  '42501', null, 'only the delete-account function prepares a deletion'
);
reset role;

select is(public.prepare_account_deletion('e5555555-0000-4000-8000-000000000001'), 'ok', 'a guest''s deletion');
select results_eq(
  $$ select ref, guest_name, guest_email::text, guest_phone, vehicle_plate, guest_note, user_id
     from public.bookings where ref in ('ANT-AAAAA1', 'ANT-AAAAA2') order by ref $$,
  $$ values
       ('ANT-AAAAA1', 'Deleted guest', 'deleted@deleted.invalid', '+0 000000', null::text, null::text, null::uuid),
       ('ANT-AAAAA2', 'Deleted guest', 'deleted@deleted.invalid', '+0 000000', null::text, null::text, null::uuid) $$,
  'anonymizes their bookings, also ones made with their email before signing in'
);
select results_eq(
  $$ select total_cents, commission_cents, status::text from public.bookings where ref = 'ANT-AAAAA1' $$,
  $$ values (5000, 300, 'completed') $$,
  '...keeping what the camping needs'
);
select is(
  (select guest_name from public.bookings where ref = 'ANT-AAAAA3'), 'John', 'other guests are untouched'
);
select is_empty($$ select 1 from public.reviews $$, 'their reviews are removed');
select results_eq(
  $$ select audience, status from public.notification_queue order by audience $$,
  $$ values ('guest', 'skipped'), ('partner', 'pending') $$,
  'their pending messages are dropped, the camping''s are not'
);

select lives_ok(
  $$ delete from auth.users where id = 'e5555555-0000-4000-8000-000000000001' $$,
  'then the login can be deleted'
);

select is(
  public.prepare_account_deletion('a1111111-0000-4000-8000-000000000001'), 'last_owner',
  'the last owner of a partner cannot leave'
);
select throws_ok(
  $$ select public.prepare_account_deletion('00000000-0000-4000-8000-000000000000') $$,
  'P0002', null, 'unknown user'
);

select * from finish();
rollback;
