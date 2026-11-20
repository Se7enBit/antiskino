-- Limits against fake bookings: per guest email, 3 overlapping active bookings
-- at a camping and 10 upcoming bookings in all (SQLSTATE ANT05).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Start from no partners or campings: seed.sql data would skew the counts.
-- Everything here is rolled back at the end.
delete from public.campings;
delete from public.partners;

-- Two campings with a tent pitch type and 20 pitches a night in July 2030.
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.campings (id, partner_id, slug, status, name, confirmation_mode) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1', 'instant'),
  ('a0000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000000', 'a2', 'live', 'A2', 'instant');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
select ('c0000000-0000-4000-8000-0000000000' || right(c.slug, 2))::uuid, c.id, '{"en": "Tent"}', '{tent}', 4
from public.campings c;
insert into public.seasons (camping_id, name, dates) select id, '{"en": "Summer"}', '[2030-06-01,2030-09-01)' from public.campings;
insert into public.guest_categories (id, camping_id, name, min_age)
select ('9a000000-0000-4000-8000-0000000000' || right(c.slug, 2))::uuid, c.id, '{"en": "Adult"}'::jsonb, 12
from public.campings c;
insert into public.inventory_nights (pitch_type_id, night, allotment)
select pt.id, night::date, 20
from public.pitch_types pt
cross join generate_series('2030-07-01'::date, '2030-07-31'::date, interval '1 day') as night;

create function pg_temp.book(p_pitch text, p_arrival date, p_departure date, p_email text)
returns text language sql as $$
  select ref from public.reserve_and_create_booking(
    ('c0000000-0000-4000-8000-0000000000' || p_pitch)::uuid, p_arrival, p_departure, 'tent',
    jsonb_build_object('9a000000-0000-4000-8000-0000000000' || p_pitch, 2), '{}',
    jsonb_build_object('name', 'Maria', 'email', p_email, 'phone', '+30 690 000 0000',
      'country', 'GR', 'locale', 'el'),
    null, 5000, '{"lines": []}', public.sha256_hex(p_email || p_arrival)
  );
$$;
create function pg_temp.booked(p_pitch text, p_night date) returns integer language sql as $$
  select n.booked from public.inventory_nights n
  where n.pitch_type_id = ('c0000000-0000-4000-8000-0000000000' || p_pitch)::uuid and n.night = p_night;
$$;

-- Per camping and stay ---------------------------------------------------------------

select pg_temp.book('a1', '2030-07-10', '2030-07-12', 'maria@test.local');
select pg_temp.book('a1', '2030-07-10', '2030-07-12', 'maria@test.local');
select lives_ok(
  $$ select pg_temp.book('a1', '2030-07-11', '2030-07-13', 'Maria@Test.local') $$,
  'a guest may book up to 3 overlapping pitches at a camping'
);
select throws_ok(
  $$ select pg_temp.book('a1', '2030-07-11', '2030-07-12', 'MARIA@test.local') $$,
  'ANT05', 'too many active bookings for this email',
  '...not a 4th (the email in any case)'
);
select is(pg_temp.booked('a1', '2030-07-11'), 3, '...which takes no night');
select lives_ok(
  $$ select pg_temp.book('a1', '2030-07-12', '2030-07-14', 'maria@test.local') $$,
  'a stay that only starts as the others end does not overlap'
);
select lives_ok(
  $$ select pg_temp.book('a2', '2030-07-10', '2030-07-12', 'maria@test.local') $$,
  'another camping has its own limit'
);
select lives_ok(
  $$ select pg_temp.book('a1', '2030-07-10', '2030-07-12', 'nikos@test.local') $$,
  'another email has its own limit'
);

update public.bookings set status = 'cancelled'
where guest_email = 'maria@test.local' and arrival = '2030-07-10' and camping_id = 'a0000000-0000-4000-8000-0000000000a1';
select lives_ok(
  $$ select pg_temp.book('a1', '2030-07-11', '2030-07-12', 'maria@test.local') $$,
  'cancelled bookings no longer count'
);

-- In all -----------------------------------------------------------------------------

select pg_temp.book('a2', ('2030-07-01'::date + 2 * n), ('2030-07-02'::date + 2 * n), 'many@test.local')
from generate_series(0, 9) n;
select throws_ok(
  $$ select pg_temp.book('a2', '2030-07-25', '2030-07-26', 'many@test.local') $$,
  'ANT05', null, 'at most 10 upcoming bookings for one email'
);
update public.bookings set departure = '2020-01-02', arrival = '2020-01-01'
where guest_email = 'many@test.local' and arrival = '2030-07-01';
select lives_ok(
  $$ select pg_temp.book('a2', '2030-07-25', '2030-07-26', 'many@test.local') $$,
  'past stays no longer count'
);

select * from finish();
rollback;
