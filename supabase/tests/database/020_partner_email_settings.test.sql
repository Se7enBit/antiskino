-- Partner email settings: members mute email kinds for themselves only.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now());
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff');
insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);
insert into public.bookings (id, ref, camping_id, pitch_type_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
values ('b0000000-0000-4000-8000-000000000001', 'ANT-AAAAA1', 'a0000000-0000-4000-8000-0000000000a1',
  'c0000000-0000-4000-8000-0000000000a1', 'Maria', 'maria@test.local', '+30 690 000 0000', 'GR', 'el',
  '2030-07-10', '2030-07-12', 'tent', '{}', 2, 'cancelled', 5000, '{}', 'on_site', 'flexible', 600, 300,
  public.sha256_hex('token'));

-- Settings ------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
update public.profiles set muted_emails = '{booking_confirmed}'
where id = 'a1111111-0000-4000-8000-000000000002';
select is(
  (select muted_emails from public.profiles where id = 'a1111111-0000-4000-8000-000000000002'),
  '{booking_confirmed}'::text[],
  'members mute an email kind for themselves'
);
update public.profiles set muted_emails = '{booking_confirmed}'
where id = 'a1111111-0000-4000-8000-000000000001';
reset role;
select is(
  (select muted_emails from public.profiles where id = 'a1111111-0000-4000-8000-000000000001'),
  '{}'::text[],
  '...not for others'
);
select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ update public.profiles set muted_emails = '{review_invite}' where id = 'a1111111-0000-4000-8000-000000000002' $$,
  '23514', null, 'only team booking emails can be muted'
);
select throws_ok(
  $$ update public.profiles set is_platform_admin = true where id = 'a1111111-0000-4000-8000-000000000002' $$,
  '42501', null, 'the other columns stay read-only'
);
reset role;

-- Claiming ------------------------------------------------------------------------

insert into public.notification_queue (kind, booking_id, audience, channel) values
  ('booking_confirmed', 'b0000000-0000-4000-8000-000000000001', 'partner', 'email'),
  ('booking_cancelled', 'b0000000-0000-4000-8000-000000000001', 'partner', 'email');
create temp table claimed as select * from public.claim_email_notifications(10);

select results_eq(
  $$ select kind, (select array_agg(r->>'email' order by r->>'email') from jsonb_array_elements(recipients) r)
     from claimed order by kind $$,
  $$ values ('booking_cancelled', array['owner@test.local', 'staff@test.local']),
            ('booking_confirmed', array['owner@test.local']) $$,
  'muted members are left out of that kind of email only'
);

-- A team where everyone muted it: nobody to send to (the notify function skips it).
update public.profiles set muted_emails = '{booking_cancelled}';
update public.notification_queue set status = 'pending', next_attempt_at = now();
create temp table claimed_again as select * from public.claim_email_notifications(10);
select is(
  (select recipients from claimed_again where kind = 'booking_cancelled'), '[]'::jsonb,
  'an email muted by the whole team has no recipients'
);
select is(
  (select jsonb_array_length(recipients) from claimed_again where kind = 'booking_confirmed'), 2,
  'unmuting brings members back'
);

select * from finish();
rollback;
