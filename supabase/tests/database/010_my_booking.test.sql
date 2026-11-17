-- my_booking(), and guest_booking() after moving to booking_view().
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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

-- Fixtures: a camping with one booking by guest G (signed in) and one by nobody.
insert into auth.users (id, email, email_confirmed_at) values
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now()),
  ('f6666666-0000-4000-8000-000000000001', 'other@test.local', now());
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
values
  ('b0000000-0000-4000-8000-000000000001', 'ANT-AAAAAA', 'a0000000-0000-4000-8000-0000000000a1',
   'c0000000-0000-4000-8000-0000000000a1', 'e5555555-0000-4000-8000-000000000001', 'Guest', 'guest@test.local',
   '+30 690 000 0000', 'GR', 'en', '2030-07-10', '2030-07-12', 'tent', '{}', 2, 'confirmed', 5000, '{}',
   'on_site', 'flexible', 600, 300, public.sha256_hex('token-a')),
  ('b0000000-0000-4000-8000-000000000002', 'ANT-BBBBBB', 'a0000000-0000-4000-8000-0000000000a1',
   'c0000000-0000-4000-8000-0000000000a1', null, 'Someone', 'someone@test.local',
   '+30 690 000 0000', 'GR', 'en', '2030-07-10', '2030-07-12', 'tent', '{}', 2, 'confirmed', 5000, '{}',
   'on_site', 'flexible', 600, 300, public.sha256_hex('token-b'));

select is(
  public.guest_booking('ANT-AAAAAA', 'token-a'),
  public.booking_view('b0000000-0000-4000-8000-000000000001'),
  'guest_booking() returns booking_view()'
);

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select results_eq(
  $$ select b ->> 'id', b ->> 'ref', b -> 'camping' ->> 'name', (b ->> 'can_cancel')::boolean from public.my_booking('ant-aaaaaa') b $$,
  $$ values ('b0000000-0000-4000-8000-000000000001', 'ANT-AAAAAA', 'A1', true) $$,
  'a signed-in guest sees their booking by reference, with its id'
);
select is(public.my_booking('ANT-BBBBBB'), null, '...but not a booking that is not theirs');
select throws_ok($$ select public.booking_view('b0000000-0000-4000-8000-000000000001') $$, '42501', null, 'booking_view() is internal');
reset role;

select pg_temp.login('f6666666-0000-4000-8000-000000000001');
select is(public.my_booking('ANT-AAAAAA'), null, 'another user sees nothing');
reset role;

select pg_temp.login(null);
select throws_ok($$ select public.my_booking('ANT-AAAAAA') $$, '42501', null, 'anon cannot call my_booking()');
select is(
  public.guest_booking('ANT-AAAAAA', 'token-a') ->> 'ref', 'ANT-AAAAAA', 'anon still opens the manage link'
);
reset role;

select * from finish();
rollback;
