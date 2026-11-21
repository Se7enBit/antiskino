-- Admin actions on bookings: correcting the guest's contact details
-- (admin_update_booking_guest) and cancelling with a reason (partner_booking_action).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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

insert into auth.users (id, email, email_confirmed_at) values
  ('ad000000-0000-4000-8000-000000000001', 'admin@test.local', now()),
  ('a1111111-0000-4000-8000-000000000001', 'owner@test.local', now());
update public.profiles set is_platform_admin = true where id = 'ad000000-0000-4000-8000-000000000001';
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'Camping A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);
insert into public.bookings (id, ref, camping_id, pitch_type_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
values ('b0000000-0000-4000-8000-000000000001', 'ANT-AAAAA1', 'a0000000-0000-4000-8000-0000000000a1',
  'c0000000-0000-4000-8000-0000000000a1', 'Maria Papa', 'maria@tset.local', '+30 690 000 0000', 'GR', 'el',
  '2030-07-10', '2030-07-12', 'tent', '{}', 2, 'confirmed', 5000, '{}', 'on_site', 'flexible', 600, 300,
  public.sha256_hex('token-1'));

create function pg_temp.fix(p_email text, p_phone text) returns void language sql as $$
  select public.admin_update_booking_guest('b0000000-0000-4000-8000-000000000001',
    '  Maria Papadopoulou ', p_email, p_phone, 'gr', 'en');
$$;

-- Who may correct details ------------------------------------------------------------

select is_definer('public', 'admin_update_booking_guest', array['uuid', 'text', 'text', 'text', 'text', 'text'],
  'admin_update_booking_guest() is security definer');

select pg_temp.login(null);
select throws_ok($$ select pg_temp.fix('maria@test.local', '+30 690 111 1111') $$, '42501', null,
  'anon cannot correct a guest''s details');
select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok($$ select pg_temp.fix('maria@test.local', '+30 690 111 1111') $$, '42501',
  'only admins can change a guest''s details', 'nor can the camping''s owner');

-- The admin corrects them --------------------------------------------------------------

select pg_temp.login('ad000000-0000-4000-8000-000000000001');
select throws_ok($$ select pg_temp.fix('maria@', '+30 690 111 1111') $$, '22023', 'invalid email',
  'a malformed email is refused');
select throws_ok($$ select pg_temp.fix('maria@test.local', '690 111') $$, '23514', null,
  'so is a phone without its country code');
select lives_ok($$ select pg_temp.fix(' maria@test.local ', '+30  690 111 1111') $$,
  'the admin corrects the guest''s details');
reset role;
select results_eq(
  $$ select guest_name, guest_email::text, guest_phone, guest_country, locale, status::text
     from public.bookings where id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Maria Papadopoulou', 'maria@test.local', '+30 690 111 1111', 'GR', 'en', 'confirmed') $$,
  '...trimmed and tidied, the status unchanged'
);
select results_eq(
  $$ select actor_kind::text, actor_user_id::text, from_status::text, to_status::text, note
     from public.booking_events where booking_id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values ('admin', 'ad000000-0000-4000-8000-000000000001', 'confirmed', 'confirmed', null::text) $$,
  '...and the change is in the history, without personal data'
);
select is(
  (select count(*)::int from public.notification_queue where booking_id = 'b0000000-0000-4000-8000-000000000001'),
  0, '...without messages to anyone'
);
select pg_temp.login('ad000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.admin_update_booking_guest('b0000000-0000-4000-8000-0000000000ff', 'X', 'x@test.local',
       '+30 690 111 1111', 'GR', 'el') $$,
  'P0002', 'booking not found', 'an unknown booking is reported'
);

-- The admin cancels with a reason --------------------------------------------------------

select throws_ok(
  $$ select public.partner_booking_action('b0000000-0000-4000-8000-000000000001', 'cancel', ' ') $$,
  '22023', 'a reason is required to cancel', 'cancelling needs a reason, for the admin too'
);
select is(
  public.partner_booking_action('b0000000-0000-4000-8000-000000000001', 'cancel', 'The camping closed after a storm'),
  'cancelled'::public.booking_status, 'the admin cancels the booking'
);
reset role;
select results_eq(
  $$ select actor_kind::text, from_status::text, to_status::text from public.booking_events
     where booking_id = 'b0000000-0000-4000-8000-000000000001' order by id desc limit 1 $$,
  $$ values ('admin', 'confirmed', 'cancelled') $$,
  '...recorded as Antiskino''s action'
);
select is(
  (select cancel_reason from public.bookings where id = 'b0000000-0000-4000-8000-000000000001'),
  'The camping closed after a storm', '...with the reason the guest will see'
);
select ok(
  exists (select 1 from public.notification_queue
          where booking_id = 'b0000000-0000-4000-8000-000000000001' and audience = 'guest' and kind = 'booking_cancelled'),
  '...and the guest is told'
);

select * from finish();
rollback;
