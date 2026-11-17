-- sellable_pitch_types() / sellable_pitch_types_at(): the availability rules of SPEC §4.1.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

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

-- Pitch types sellable "now" = 2027-06-20 10:00 in Athens (UTC+3 in summer).
create function pg_temp.sellable(
  p_arrival date, p_departure date, p_equipment public.equipment, p_party integer,
  p_now timestamptz default '2027-06-20 10:00:00+03', p_camping uuid default null
) returns setof uuid language sql as $$
  select pitch_type_id from public.sellable_pitch_types_at(p_now, p_arrival, p_departure, p_equipment, p_party, p_camping);
$$;

-- Fixtures:
--   camping a1 (live, cutoff 14:00): tent pitch (tent, 4 people), caravan pitch
--   (caravan + camper, 6 people), hidden tent pitch (inactive);
--   camping b1 (live): tent pitch; camping d1 (draft): tent pitch.
--   Seasons: low 2027-06-01..06-30 (min 1 night), high 2027-07-01..08-31 (min 3).
--   Inventory: 2 pitches a night up to 2027-09-05 (past the last season), from
--   06-20 for tent pitches and 06-25 for the caravan pitch. The a1 tent pitch is
--   full on 07-10; the caravan pitch is closed on 07-12.
insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
insert into public.campings (id, partner_id, slug, status, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'live', 'A1'),
  ('b0000000-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000000', 'b1', 'live', 'B1'),
  ('d0000000-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-000000000000', 'd1', 'draft', 'D1');
insert into public.pitch_types (id, camping_id, name, accepts, max_people, active) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Tent"}', '{tent}', 4, true),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Caravan"}', '{caravan,camper}', 6, true),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000a1', '{"en": "Hidden"}', '{tent}', 4, false),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b1', '{"en": "B tent"}', '{tent}', 4, true),
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000d1', '{"en": "D tent"}', '{tent}', 4, true);
insert into public.seasons (camping_id, name, dates, min_nights)
select c.id, s.name, s.dates, s.min_nights
from (values ('a0000000-0000-4000-8000-0000000000a1'::uuid), ('b0000000-0000-4000-8000-0000000000b1'), ('d0000000-0000-4000-8000-0000000000d1')) as c (id)
cross join (values
  ('{"en": "Low"}'::jsonb, '[2027-06-01,2027-07-01)'::daterange, 1),
  ('{"en": "High"}'::jsonb, '[2027-07-01,2027-09-01)'::daterange, 3)
) as s (name, dates, min_nights);
insert into public.inventory_nights (pitch_type_id, night, allotment)
select pt.id, night::date, 2
from public.pitch_types pt
cross join generate_series('2027-06-20'::date, '2027-09-05'::date, interval '1 day') as night
where pt.id <> 'a1000000-0000-4000-8000-000000000002' or night >= '2027-06-25';
update public.inventory_nights set booked = 2
where pitch_type_id = 'a1000000-0000-4000-8000-000000000001' and night = '2027-07-10';
update public.inventory_nights set closed = true
where pitch_type_id = 'a1000000-0000-4000-8000-000000000002' and night = '2027-07-12';

-- ---------------------------------------------------------------------------

select is_definer('public', 'sellable_pitch_types', array['date', 'date', 'equipment', 'integer', 'uuid'], 'sellable_pitch_types() is security definer');

select set_eq(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'tent', 2) $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid), ('b1000000-0000-4000-8000-000000000001') $$,
  'tent pitches of live campings are sellable; hidden pitch types and draft campings are not'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'tent', 2, p_camping => 'a0000000-0000-4000-8000-0000000000a1') $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'results can be limited to one camping'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'camper', 5) $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  'only pitch types accepting the equipment are sellable'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'tent', 5) $$,
  'a party larger than max_people is not sellable (infants count)'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'tent', 4) $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid), ('b1000000-0000-4000-8000-000000000001') $$,
  'a party of exactly max_people is sellable'
);

-- minimum nights come from the arrival night's season
select is_empty(
  $$ select * from pg_temp.sellable('2027-07-01', '2027-07-03', 'tent', 2, p_camping => 'b0000000-0000-4000-8000-0000000000b1') $$,
  'a 2-night stay is too short in a 3-night season'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-07-01', '2027-07-04', 'tent', 2, p_camping => 'b0000000-0000-4000-8000-0000000000b1') $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  '3 nights meet the 3-night minimum'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-30', '2027-07-02', 'tent', 2, p_camping => 'b0000000-0000-4000-8000-0000000000b1') $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'a stay arriving in a 1-night season may run into the next season'
);

-- every night must be open, have room and inventory, and be in a season
select set_eq(
  $$ select * from pg_temp.sellable('2027-07-09', '2027-07-12', 'tent', 2) $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'a full night (booked = allotment) makes the stay unsellable'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-07-11', '2027-07-14', 'caravan', 2) $$,
  'a closed night makes the stay unsellable'
);
select set_eq(
  $$ select * from pg_temp.sellable('2027-07-13', '2027-07-16', 'caravan', 2) $$,
  $$ values ('a1000000-0000-4000-8000-000000000002'::uuid) $$,
  '...while the nights after it sell'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-06-22', '2027-06-26', 'caravan', 2) $$,
  'nights without inventory are not sellable'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-08-30', '2027-09-02', 'tent', 2) $$,
  'nights outside every season are not sellable'
);

-- arrival: today until the same-day cutoff (14:00 by default), never in the past
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-20', '2027-06-21', 'tent', 2, '2027-06-20 13:59:00+03', 'a0000000-0000-4000-8000-0000000000a1') $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'arriving today is sellable before the cutoff'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-06-20', '2027-06-21', 'tent', 2, '2027-06-20 14:00:00+03') $$,
  '...and not from the cutoff on'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-06-20', '2027-06-21', 'tent', 2, '2027-06-20 11:30:00+00') $$,
  'the cutoff uses Athens time (11:30 UTC is 14:30 there)'
);
update public.campings set same_day_cutoff = '18:00' where id = 'a0000000-0000-4000-8000-0000000000a1';
select set_eq(
  $$ select * from pg_temp.sellable('2027-06-20', '2027-06-21', 'tent', 2, '2027-06-20 15:00:00+03') $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'each camping sets its own cutoff'
);
select is_empty(
  $$ select * from pg_temp.sellable('2027-06-20', '2027-06-21', 'tent', 2, '2027-06-21 09:00:00+03') $$,
  'an arrival in the past is not sellable'
);

select throws_ok(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-25', 'tent', 2) $$,
  '22023', null,
  'a stay needs at least one night'
);
select throws_ok(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-07-26', 'tent', 2) $$,
  '22023', null,
  'a stay is at most 30 nights'
);
select throws_ok(
  $$ select * from pg_temp.sellable('2027-06-25', '2027-06-27', 'tent', 0) $$,
  '22023', null,
  'a party needs at least one person'
);

-- grants: anon calls the wrapper (it uses the real clock, so 2027 dates are in the future)
select pg_temp.login(null);
select set_eq(
  $$ select pitch_type_id from public.sellable_pitch_types('2027-06-25', '2027-06-27', 'tent', 2) $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid), ('b1000000-0000-4000-8000-000000000001') $$,
  'anon can call sellable_pitch_types()'
);
select throws_ok(
  $$ select * from public.sellable_pitch_types_at(now(), '2027-06-25', '2027-06-27', 'tent', 2) $$,
  '42501', null,
  'anon cannot pick the clock with sellable_pitch_types_at()'
);
select throws_ok(
  $$ select 1 from public.inventory_nights $$,
  '42501', null,
  'anon still cannot read inventory'
);
reset role;

select * from finish();
rollback;
