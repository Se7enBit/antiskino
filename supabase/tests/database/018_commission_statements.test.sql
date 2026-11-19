-- Commission statements: totals of completed stays per month, admin-only status, who reads them.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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
  ('a1111111-0000-4000-8000-000000000001', 'owner@test.local', now()),
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now()),
  ('b2222222-0000-4000-8000-000000000001', 'other@test.local', now()),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local', now());
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';
insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, status, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4);

-- July 2027: two completed stays (300 + 450), one cancelled, one no-show; one completed in August.
insert into public.bookings (id, ref, camping_id, pitch_type_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
select ('b0000000-0000-4000-8000-00000000000' || n)::uuid, 'ANT-AAAAA' || n,
  'a0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-0000000000a1', 'Guest', 'g@test.local',
  '+30 690 000 0000', 'GR', 'en', (d::date - 2), d::date, 'tent', '{}', 2, s::public.booking_status, 5000, '{}',
  'on_site', 'flexible', 600, c, public.sha256_hex('t' || n)
from (values
  (1, '2027-07-05', 'completed', 300),
  (2, '2027-07-31', 'completed', 450),
  (3, '2027-07-20', 'cancelled', 300),
  (4, '2027-07-21', 'no_show', 300),
  (5, '2027-08-01', 'completed', 999)
) v(n, d, s, c);

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is(
  public.set_commission_statement('aaaaaaaa-0000-4000-8000-000000000000', '2027-07-15', 'sent'), 750,
  'a month''s statement totals the commission of stays completed that month'
);
select results_eq(
  $$ select month::text, total_cents, status from public.commission_statements $$,
  $$ values ('2027-07-01', 750, 'sent') $$,
  '...and is kept for the month'
);
select is(
  public.set_commission_statement('aaaaaaaa-0000-4000-8000-000000000000', '2027-07-01', 'paid'), 750,
  'marking it paid updates the same statement'
);
select is((select count(*)::integer from public.commission_statements), 1, '...one per partner and month');
select throws_ok(
  $$ select public.set_commission_statement('aaaaaaaa-0000-4000-8000-000000000000', '2027-07-01', 'lost') $$,
  '22023', null, 'unknown statuses are refused'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.commission_statements), 1, 'the partner''s owner sees it');
select throws_ok(
  $$ select public.set_commission_statement('aaaaaaaa-0000-4000-8000-000000000000', '2027-07-01', 'open') $$,
  '42501', null, '...but only admins change it'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is_empty($$ select 1 from public.commission_statements $$, 'staff do not see statements');
reset role;

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select is_empty($$ select 1 from public.commission_statements $$, 'other partners do not see them');
reset role;

select * from finish();
rollback;
