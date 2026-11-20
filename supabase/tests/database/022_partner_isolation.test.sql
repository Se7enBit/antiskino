-- SPEC §8: a member of partner A reads no row of partner B, and anon reads none,
-- in EVERY table and view of the public schema (new tables are covered too).
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

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

-- Rows the current role can read in each public table or view; a table it may
-- not read at all counts as 0. Runs with the caller's rights (and RLS).
create function pg_temp.readable_rows() returns table (relname text, n bigint) language plpgsql as $$
declare
  r record;
begin
  for r in
    select c.relname::text as name from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'v', 'm') order by 1
  loop
    relname := r.name;
    begin
      execute format('select count(*) from public.%I', r.name) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    return next;
  end loop;
end;
$$;
grant execute on function pg_temp.readable_rows() to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local', now()),
  ('b1111111-0000-4000-8000-000000000001', 'owner-b@test.local', now()),
  ('b1111111-0000-4000-8000-000000000002', 'staff-b@test.local', now()),
  ('e5555555-0000-4000-8000-000000000001', 'guest@test.local', now());
insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b1111111-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b1111111-0000-4000-8000-000000000002', 'staff');

-- Partner B: one camping with a row in every table. Draft, so none of it is
-- public; partner A has no camping.
insert into public.campings (id, partner_id, slug, status, name)
values ('b0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'b1', 'draft', 'B1');
insert into public.camping_photos (camping_id, storage_path)
values ('b0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1/one.jpg');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('c0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "Tent"}', '{tent}', 4);
insert into public.seasons (id, camping_id, name, dates, min_nights)
values ('d0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "Summer"}',
        '[2030-06-01,2030-09-01)', 1);
insert into public.guest_categories (id, camping_id, name, min_age)
values ('e0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "Adult"}', 18);
insert into public.extras (id, camping_id, name, unit, max_qty)
values ('f0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "Car"}', 'per_night', 1);
insert into public.fees (camping_id, name, unit, amount_cents)
values ('b0000000-0000-4000-8000-0000000000b1', '{"en": "Tax"}', 'per_stay', 100);
insert into public.prices (season_id, item_type, item_id, amount_cents)
values ('d0000000-0000-4000-8000-0000000000b1', 'pitch', 'c0000000-0000-4000-8000-0000000000b1', 2000);
select pg_temp.login('b1111111-0000-4000-8000-000000000001');
select public.set_allotment('c0000000-0000-4000-8000-0000000000b1', '2030-06-01', '2030-06-10', 5);
reset role;
insert into public.bookings (id, ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone,
  guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents, price_breakdown,
  payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
values ('90000000-0000-4000-8000-0000000000b1', 'ANT-BBBBB1', 'b0000000-0000-4000-8000-0000000000b1',
  'c0000000-0000-4000-8000-0000000000b1', 'e5555555-0000-4000-8000-000000000001', 'Maria', 'guest@test.local',
  '+30 690 000 0000', 'GR', 'el', '2030-06-02', '2030-06-04', 'tent', '{}', 2, 'completed', 4000, '{}',
  'on_site', 'flexible', 600, 240, public.sha256_hex('token-b'));
insert into public.booking_events (booking_id, actor_kind, to_status)
values ('90000000-0000-4000-8000-0000000000b1', 'system', 'completed');
insert into public.notification_queue (kind, booking_id, audience, channel)
values ('booking_confirmed', '90000000-0000-4000-8000-0000000000b1', 'partner', 'email');
insert into public.reviews (booking_id, camping_id, user_id, rating, locale, author_name, author_country, stay_month)
values ('90000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-0000000000b1',
        'e5555555-0000-4000-8000-000000000001', 5, 'el', 'Maria', 'GR', '2030-06-01');
insert into public.partner_invites (partner_id, email, role, token_hash, expires_at)
values ('bbbbbbbb-0000-4000-8000-000000000000', 'new@test.local', 'staff', repeat('ab', 32), now() + interval '7 days');
insert into public.commission_statements (partner_id, month, total_cents, status)
values ('bbbbbbbb-0000-4000-8000-000000000000', '2030-06-01', 240, 'sent');
insert into public.push_tokens (token, user_id, platform)
values ('ExponentPushToken[partner-b-staff]', 'b1111111-0000-4000-8000-000000000002', 'android');
insert into public.favorites (user_id, camping_id)
values ('e5555555-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1');

-- The fixture really fills every table (a new table without a row here fails this).
select is_empty(
  $$ select relname from pg_temp.readable_rows() where n = 0 and relname not in ('camping_ratings') $$,
  'partner B has rows in every table'
);

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is_empty(
  $$ select relname, n from pg_temp.readable_rows()
     where n > case when relname in ('partners', 'partner_members', 'profiles') then 1 else 0 end $$,
  'a member of partner A reads no row of partner B in any table'
);
select results_eq(
  $$ select (select name from public.partners), (select partner_id::text from public.partner_members),
            (select id::text from public.profiles) $$,
  $$ values ('Partner A', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001') $$,
  '...only its own partner, membership and profile'
);
reset role;

select pg_temp.login(null);
select is_empty(
  $$ select relname, n from pg_temp.readable_rows() where n > 0 $$,
  'anon reads nothing that is not public (bookings included)'
);
reset role;

select * from finish();
rollback;
