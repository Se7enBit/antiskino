-- Demo data for the DEV project only (never production), to try every screen:
-- a "Demo Campings" partner owned by the platform admins (you) with three live
-- campings (Halkidiki, Pelion, Mani), seasons, prices, a year of pitches, and
-- bookings around today: guests in house, arriving and leaving today, requests
-- to answer, upcoming and cancelled stays, reviews, and two bookings of your
-- own (My bookings: one upcoming, one past stay you can review).
--
-- Run it in the Supabase dashboard → dev project → SQL editor. Running it again
-- replaces the demo data with fresh dates. No emails or pushes go out for it.
-- Prices are in cents. Guest emails are @example.org.

begin;

-- You: the first platform admin.
create temp table demo_me on commit drop as
select p.id, u.email::text as email
from public.profiles p join auth.users u on u.id = p.id
where p.is_platform_admin
order by u.created_at
limit 1;

do $$
begin
  if not exists (select 1 from demo_me) then
    raise exception 'No platform admin yet: sign in once and make yourself admin first.';
  end if;
end;
$$;

-- Today in Athens, and the next summer season (July and August).
create temp table demo_day on commit drop as
select d0,
  make_date(extract(year from d0)::int + case when d0 >= make_date(extract(year from d0)::int, 7, 1) then 1 else 0 end, 7, 1) as summer
from (select (now() at time zone 'Europe/Athens')::date as d0) t;

-- ---------------------------------------------------------------------------
-- Remove the previous demo data
-- ---------------------------------------------------------------------------

delete from public.bookings
where camping_id in (select id from public.campings where partner_id = 'd0000000-0000-4000-8000-0000000000d1');
delete from public.campings where partner_id = 'd0000000-0000-4000-8000-0000000000d1';
delete from public.partners where id = 'd0000000-0000-4000-8000-0000000000d1';

-- ---------------------------------------------------------------------------
-- Partner and campings
-- ---------------------------------------------------------------------------

insert into public.partners (id, name, legal_name, billing_email)
values ('d0000000-0000-4000-8000-0000000000d1', 'Demo Campings', 'Demo Campings IKE', 'billing@example.org');

insert into public.partner_members (partner_id, user_id, role)
select 'd0000000-0000-4000-8000-0000000000d1', p.id, 'owner'
from public.profiles p where p.is_platform_admin;

insert into public.campings (
  id, partner_id, slug, status, name, short_descr, descr, house_rules,
  region, address, lat, lng, phone, email, amenities,
  check_in_from, check_out_until, confirmation_mode, request_expiry_hours, cancellation_policy
) values
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000d1', 'thalassa-demo', 'live',
   'Camping Thalassa (demo)',
   '{"el": "Σκιερές θέσεις δίπλα στη θάλασσα της Σιθωνίας.", "en": "Shady pitches right by the sea in Sithonia."}',
   '{"el": "Ήσυχο οικογενειακό κάμπινγκ με πεύκα, αμμουδιά και ταβέρνα.", "en": "A quiet family camping with pine trees, a sandy beach and a taverna."}',
   '{"el": "Ησυχία 23:00–08:00. Τα σκυλιά με λουρί.", "en": "Quiet hours 23:00–08:00. Dogs on a lead."}',
   'halkidiki', 'Sarti, Sithonia, 630 72 Halkidiki', 40.0915, 23.9800, '+30 2375 000000', 'thalassa@example.org',
   '{hot_showers,electricity,wifi,beach_access,mini_market,restaurant,shade,pets_allowed}',
   '14:00', '12:00', 'instant', 24, 'moderate'),
  ('d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-0000000000d1', 'pefka-demo', 'live',
   'Camping Pefka (demo)',
   '{"el": "Θέσεις κάτω από τα πεύκα, στους πρόποδες του Πηλίου.", "en": "Pitches under the pines at the foot of Mount Pelion."}',
   '{"el": "Δροσερό κάμπινγκ κοντά σε χωριά και μονοπάτια. Οι κρατήσεις επιβεβαιώνονται από τη ρεσεψιόν.", "en": "A cool camping near villages and hiking paths. Reception confirms each booking."}',
   '{"el": "Φωτιές μόνο στις ψησταριές.", "en": "Fires only in the barbecue area."}',
   'pelion', 'Kala Nera, 370 10 Magnesia', 39.3176, 23.1167, '+30 2423 000000', 'pefka@example.org',
   '{hot_showers,electricity,wifi,bbq,playground,shade,laundry}',
   '13:00', '11:00', 'request', 24, 'flexible'),
  ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-0000000000d1', 'kastri-demo', 'live',
   'Camping Kastri (demo)',
   '{"el": "Πέτρινες πεζούλες πάνω από τον κόλπο της Μάνης.", "en": "Stone terraces above the bay of Mani."}',
   '{"el": "Μικρό κάμπινγκ με πισίνα και θέα στο ηλιοβασίλεμα.", "en": "A small camping with a pool and sunset views."}',
   '{"el": "Η πισίνα είναι ανοιχτή 09:00–20:00.", "en": "The pool is open 09:00–20:00."}',
   'peloponnese', 'Kardamyli, 240 22 Messinia', 36.8870, 22.2330, '+30 2721 000000', 'kastri@example.org',
   '{hot_showers,electricity,pool,bar,shared_kitchen}',
   '15:00', '11:00', 'instant', 24, 'strict');

insert into public.pitch_types (id, camping_id, name, included, accepts, max_people, size_m2, sort) values
  ('d2000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000001',
   '{"el": "Θέση σκηνής", "en": "Tent pitch"}', '{"el": "Ντους και κοινόχρηστοι χώροι", "en": "Showers and shared facilities"}',
   '{tent}', 4, 50, 1),
  ('d2000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000001',
   '{"el": "Θέση τροχόσπιτου", "en": "Caravan pitch"}', '{"el": "Ρεύμα και νερό στη θέση", "en": "Electricity and water at the pitch"}',
   '{caravan,camper}', 6, 80, 2),
  ('d2000000-0000-4000-8000-000000000021', 'd1000000-0000-4000-8000-000000000002',
   '{"el": "Σκηνή στα πεύκα", "en": "Tent under the pines"}', '{}', '{tent}', 4, 45, 1),
  ('d2000000-0000-4000-8000-000000000022', 'd1000000-0000-4000-8000-000000000002',
   '{"el": "Θέση αυτοκινούμενου", "en": "Camper pitch"}', '{"el": "Ρεύμα", "en": "Electricity"}',
   '{camper,caravan}', 5, 70, 2),
  ('d2000000-0000-4000-8000-000000000031', 'd1000000-0000-4000-8000-000000000003',
   '{"el": "Πεζούλα για σκηνή", "en": "Terrace tent pitch"}', '{}', '{tent}', 3, 35, 1),
  ('d2000000-0000-4000-8000-000000000032', 'd1000000-0000-4000-8000-000000000003',
   '{"el": "Μεγάλη θέση", "en": "Large pitch"}', '{"el": "Ρεύμα και σκιά", "en": "Electricity and shade"}',
   '{tent,caravan,camper}', 6, 90, 2);

-- Adults, children, infants (free) at each camping.
insert into public.guest_categories (id, camping_id, name, min_age, max_age, sort)
select ('d3000000-0000-4000-8000-00000000' || right(c.id::text, 2) || g.suffix)::uuid, c.id, g.name::jsonb, g.min_age, g.max_age, g.sort
from public.campings c
cross join (values
  ('a1', '{"el": "Ενήλικας", "en": "Adult"}', 13, null::int, 1),
  ('c1', '{"el": "Παιδί (3–12)", "en": "Child (3–12)"}', 3, 12, 2),
  ('b1', '{"el": "Βρέφος (0–2)", "en": "Infant (0–2)"}', 0, 2, 3)
) g (suffix, name, min_age, max_age, sort)
where c.partner_id = 'd0000000-0000-4000-8000-0000000000d1';

insert into public.extras (id, camping_id, name, unit, max_qty, sort)
select ('d5000000-0000-4000-8000-00000000' || right(c.id::text, 2) || e.suffix)::uuid, c.id, e.name::jsonb, e.unit::public.extra_unit, e.max_qty, e.sort
from public.campings c
cross join (values
  ('e1', '{"el": "Αυτοκίνητο", "en": "Car"}', 'per_night', 2, 1),
  ('e2', '{"el": "Ρεύμα (θέση σκηνής)", "en": "Electricity (tent pitch)"}', 'per_night', 1, 2),
  ('e3', '{"el": "Σκύλος", "en": "Dog"}', 'per_night', 2, 3),
  ('e4', '{"el": "Τελικός καθαρισμός", "en": "Final cleaning"}', 'per_stay', 1, 4)
) e (suffix, name, unit, max_qty, sort)
where c.partner_id = 'd0000000-0000-4000-8000-0000000000d1';

-- ---------------------------------------------------------------------------
-- Seasons and prices: low season around a summer (July–August, 3-night minimum)
-- ---------------------------------------------------------------------------

insert into public.seasons (camping_id, name, dates, min_nights)
select c.id, s.name::jsonb, s.dates, s.min_nights
from public.campings c
cross join demo_day d
cross join lateral (values
  ('{"el": "Χαμηλή περίοδος", "en": "Low season"}', daterange(d.d0 - 120, d.summer), 1),
  ('{"el": "Καλοκαίρι", "en": "Summer"}', daterange(d.summer, d.summer + 62), 3),
  ('{"el": "Φθινόπωρο", "en": "Autumn"}', daterange(d.summer + 62, d.d0 + 400), 1)
) s (name, dates, min_nights)
where c.partner_id = 'd0000000-0000-4000-8000-0000000000d1';

-- (item, low price, summer price) per camping: a bit dearer by the sea.
insert into public.prices (season_id, item_type, item_id, amount_cents)
select s.id, i.item_type::public.price_item_type, i.item_id,
       round(case when s.name ->> 'en' = 'Summer' then i.high else i.low end * c.factor)::int
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 1.2),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 1.0),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 1.1)
) c (camping_id, factor)
join public.seasons s on s.camping_id = c.camping_id
cross join lateral (
  select 'pitch' as item_type, pt.id as item_id,
         case when 'tent' = any (pt.accepts) and cardinality(pt.accepts) = 1 then 900 else 1500 end as low,
         case when 'tent' = any (pt.accepts) and cardinality(pt.accepts) = 1 then 1400 else 2300 end as high
  from public.pitch_types pt where pt.camping_id = c.camping_id
  union all
  select 'guest', g.id,
         case when g.min_age >= 13 then 700 when g.min_age >= 3 then 400 else 0 end,
         case when g.min_age >= 13 then 950 when g.min_age >= 3 then 550 else 0 end
  from public.guest_categories g where g.camping_id = c.camping_id
  union all
  select 'extra', e.id,
         case right(e.id::text, 2) when 'e1' then 300 when 'e2' then 450 when 'e3' then 200 else 1500 end,
         case right(e.id::text, 2) when 'e1' then 400 when 'e2' then 500 when 'e3' then 300 else 1500 end
  from public.extras e where e.camping_id = c.camping_id
) i;

-- A year of pitches, set as an admin would (set_allotment checks who asks).
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from demo_me), 'role', 'authenticated')::text, true);
select public.set_allotment(pt.id, d.d0 - 7, d.d0 + 365,
  case right(pt.id::text, 2) when '11' then 12 when '12' then 6 when '21' then 8 when '22' then 4 when '31' then 5 else 4 end)
from public.pitch_types pt cross join demo_day d
where pt.camping_id in (select id from public.campings where partner_id = 'd0000000-0000-4000-8000-0000000000d1');
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

-- The price breakdown the app shows, computed like the server's pricing
-- (per-night pitch, guests and extras; per-stay extras at the arrival's prices).
create or replace function pg_temp.demo_quote(p_pitch uuid, p_arrival date, p_departure date, p_party jsonb, p_extras jsonb)
returns jsonb language sql as $$
  with items as (
    select 'pitch' as kind, p_pitch as id, 1 as qty, 'night' as per
    union all
    select 'guest', key::uuid, value::int, 'night' from jsonb_each_text(p_party) where value::int > 0
    union all
    select 'extra', e.id, x.value::int, case e.unit when 'per_night' then 'night' else 'stay' end
    from jsonb_each_text(p_extras) x join public.extras e on e.id = x.key::uuid
    where x.value::int > 0
  ),
  nights as (
    select n::date as night, s.id as season_id
    from generate_series(p_arrival, p_departure - 1, interval '1 day') n
    join public.pitch_types pt on pt.id = p_pitch
    join public.seasons s on s.camping_id = pt.camping_id and s.dates @> n::date
  ),
  charges as (
    select i.kind, i.id, i.qty, i.per, n.night, n.season_id, pr.amount_cents * i.qty as cents
    from items i
    join nights n on i.per = 'night' or n.night = p_arrival
    join public.prices pr on pr.season_id = n.season_id and pr.item_type::text = i.kind and pr.item_id = i.id
  )
  select jsonb_build_object(
    'nights', (select jsonb_agg(jsonb_build_object('night', night, 'seasonId', season_id, 'totalCents', t) order by night)
               from (select night, season_id, sum(cents) filter (where per = 'night')::int as t
                     from charges group by night, season_id) n),
    'lines', (select jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'quantity', qty, 'per', per, 'totalCents', t))
              from (select kind, id, qty, per, sum(cents)::int as t from charges group by kind, id, qty, per) l),
    'totalCents', (select sum(cents)::int from charges),
    'names', jsonb_build_object(
      'pitch', (select name from public.pitch_types where id = p_pitch),
      'guest', (select coalesce(jsonb_object_agg(g.id, g.name), '{}') from public.guest_categories g
                where g.camping_id = (select camping_id from public.pitch_types where id = p_pitch)),
      'extra', (select coalesce(jsonb_object_agg(e.id, e.name), '{}') from public.extras e
                where e.camping_id = (select camping_id from public.pitch_types where id = p_pitch)),
      'fee', '{}'::jsonb
    )
  );
$$;

-- A guest's details as reserve_and_create_booking takes them.
create or replace function pg_temp.demo_guest(p_name text, p_email text, p_country text, p_locale text,
  p_plate text default null, p_eta text default null, p_note text default null)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('name', p_name, 'email', p_email, 'phone', '+30 690 000 0000',
    'country', p_country, 'locale', p_locale, 'vehicle_plate', p_plate, 'arrival_eta', p_eta, 'note', p_note));
$$;

-- A booking made the normal way (future stays): reserve_and_create_booking.
create or replace function pg_temp.demo_book(p_pitch text, p_from int, p_nights int, p_party jsonb, p_guest jsonb,
  p_equipment public.equipment default 'tent', p_extras jsonb default '{}', p_user uuid default null)
returns uuid language plpgsql as $$
declare
  v_pitch uuid := ('d2000000-0000-4000-8000-0000000000' || p_pitch)::uuid;
  v_arrival date := (select d0 from demo_day) + p_from;
  v_quote jsonb := pg_temp.demo_quote(v_pitch, v_arrival, v_arrival + p_nights, p_party, p_extras);
  v_id uuid;
begin
  select r.booking_id into v_id from public.reserve_and_create_booking(
    v_pitch, v_arrival, v_arrival + p_nights, p_equipment, p_party, p_extras, p_guest, p_user,
    (v_quote ->> 'totalCents')::int, v_quote, public.sha256_hex(gen_random_uuid()::text)) r;
  return v_id;
end;
$$;

-- Stays the booking function refuses (already started, or past): written
-- directly with their nights counted, as the reception screens would have left them.
create or replace function pg_temp.demo_stay(p_pitch text, p_from int, p_nights int, p_party jsonb, p_guest jsonb,
  p_status public.booking_status, p_assigned text default null, p_user uuid default null,
  p_equipment public.equipment default 'tent')
returns uuid language plpgsql as $$
declare
  v_pitch uuid := ('d2000000-0000-4000-8000-0000000000' || p_pitch)::uuid;
  v_arrival date := (select d0 from demo_day) + p_from;
  v_quote jsonb := pg_temp.demo_quote(v_pitch, v_arrival, v_arrival + p_nights, p_party, '{}');
  v_camping public.campings;
  v_total int := coalesce((v_quote ->> 'totalCents')::int, 0);
  v_id uuid;
begin
  select c.* into v_camping from public.campings c join public.pitch_types pt on pt.camping_id = c.id where pt.id = v_pitch;
  insert into public.bookings (
    ref, camping_id, pitch_type_id, user_id, guest_name, guest_email, guest_phone, guest_country, locale,
    vehicle_plate, arrival_eta, guest_note, arrival, departure, equipment, party, party_size, extras, status,
    total_cents, price_breakdown, payment_mode, cancellation_policy, commission_bps, commission_cents,
    manage_token_hash, assigned_pitch, created_at
  ) values (
    public.new_booking_ref(), v_camping.id, v_pitch, p_user, p_guest ->> 'name', p_guest ->> 'email',
    p_guest ->> 'phone', p_guest ->> 'country', p_guest ->> 'locale', p_guest ->> 'vehicle_plate',
    (p_guest ->> 'arrival_eta')::time, p_guest ->> 'note', v_arrival, v_arrival + p_nights, p_equipment, p_party,
    (select sum(value::int) from jsonb_each_text(p_party)), '{}', p_status, v_total, v_quote, 'on_site',
    v_camping.cancellation_policy, 600, round(v_total * 0.06)::int,
    public.sha256_hex(gen_random_uuid()::text), p_assigned, now() - make_interval(days => 20 - least(p_from, 0))
  ) returning id into v_id;
  insert into public.booking_events (booking_id, actor_kind, to_status, at)
  values (v_id, 'guest', 'confirmed', now() - make_interval(days => 20 - least(p_from, 0)));
  if p_status <> 'confirmed' then
    insert into public.booking_events (booking_id, actor_kind, from_status, to_status)
    values (v_id, case p_status when 'completed' then 'system' else 'partner' end::public.booking_actor, 'confirmed', p_status);
  end if;
  -- Guests still on site (or arriving today) hold their pitch for each night.
  if p_status in ('confirmed', 'checked_in') then
    update public.inventory_nights n set booked = n.booked + 1
    where n.pitch_type_id = v_pitch and n.night >= v_arrival and n.night < v_arrival + p_nights;
  end if;
  return v_id;
end;
$$;

create temp table demo_ids (id uuid) on commit drop;

-- Party shortcuts: adults (a), children (c), infants (b) of a camping.
create or replace function pg_temp.party(p_camping int, p_adults int, p_children int default 0, p_infants int default 0)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'd3000000-0000-4000-8000-00000000' || lpad(p_camping::text, 2, '0') || 'a1', nullif(p_adults, 0),
    'd3000000-0000-4000-8000-00000000' || lpad(p_camping::text, 2, '0') || 'c1', nullif(p_children, 0),
    'd3000000-0000-4000-8000-00000000' || lpad(p_camping::text, 2, '0') || 'b1', nullif(p_infants, 0)));
$$;

-- Thalassa (instant): reception's day, upcoming stays, a cancellation, reviews.
insert into demo_ids select pg_temp.demo_stay('11', -1, 4, pg_temp.party(1, 2, 1),
  pg_temp.demo_guest('Giorgos Papadakis', 'giorgos.p@example.org', 'GR', 'el', 'NHK 4821'), 'checked_in', 'A12');
insert into demo_ids select pg_temp.demo_stay('12', -3, 3, pg_temp.party(1, 2),
  pg_temp.demo_guest('Anna Müller', 'anna.mueller@example.org', 'DE', 'en', 'M AB 1234'), 'checked_in', 'C3', null, 'caravan');
insert into demo_ids select pg_temp.demo_stay('11', 0, 2, pg_temp.party(1, 2, 0, 1),
  pg_temp.demo_guest('Lukas Schmidt', 'lukas.schmidt@example.org', 'AT', 'en', null, '16:30', 'We arrive with a small dog.'), 'confirmed');
insert into demo_ids select pg_temp.demo_book('11', 1, 3, pg_temp.party(1, 2),
  pg_temp.demo_guest('Sophie Martin', 'sophie.martin@example.org', 'FR', 'en', null, '14:00'));
insert into demo_ids select pg_temp.demo_book('12', 7, 4, pg_temp.party(1, 2, 2),
  pg_temp.demo_guest('Marco Rossi', 'marco.rossi@example.org', 'IT', 'en', 'FG 123 XY'), 'camper',
  '{"d5000000-0000-4000-8000-0000000001e1": 1}');
insert into demo_ids select pg_temp.demo_book('11', (select summer - d0 + 9 from demo_day), 5, pg_temp.party(1, 2, 1),
  pg_temp.demo_guest('Eleni Kosta', 'eleni.kosta@example.org', 'GR', 'el'), 'tent',
  '{"d5000000-0000-4000-8000-0000000001e2": 1, "d5000000-0000-4000-8000-0000000001e4": 1}');
insert into demo_ids select pg_temp.demo_book('11', 12, 2, pg_temp.party(1, 1),
  pg_temp.demo_guest('Tom Baker', 'tom.baker@example.org', 'GB', 'en'));
select public.transition_booking(id, 'cancelled', 'guest', null, 'Plans changed')
from demo_ids d join public.bookings b using (id) where b.guest_email = 'tom.baker@example.org';

-- Past stays with reviews (3, so the camping shows its rating).
insert into demo_ids select pg_temp.demo_stay('11', -70, 5, pg_temp.party(1, 2, 2),
  pg_temp.demo_guest('Katerina Ioannou', 'katerina.i@example.org', 'GR', 'el'), 'completed');
insert into demo_ids select pg_temp.demo_stay('12', -55, 7, pg_temp.party(1, 2),
  pg_temp.demo_guest('Jan de Vries', 'jan.devries@example.org', 'NL', 'en'), 'completed', null, null, 'camper');
insert into demo_ids select pg_temp.demo_stay('11', -40, 3, pg_temp.party(1, 2),
  pg_temp.demo_guest('Maria Lopez', 'maria.lopez@example.org', 'ES', 'en'), 'completed');

-- Pefka (requests): two to answer, one accepted.
insert into demo_ids select pg_temp.demo_book('21', 10, 3, pg_temp.party(2, 2, 1),
  pg_temp.demo_guest('Nikos Andreou', 'nikos.andreou@example.org', 'GR', 'el', null, null, 'Can we have a pitch near the playground?'));
insert into demo_ids select pg_temp.demo_book('22', 21, 4, pg_temp.party(2, 2),
  pg_temp.demo_guest('Julia Weber', 'julia.weber@example.org', 'DE', 'en', 'B JW 2024'), 'camper');
insert into demo_ids select pg_temp.demo_book('21', 5, 2, pg_temp.party(2, 2),
  pg_temp.demo_guest('Pieter Jansen', 'pieter.jansen@example.org', 'NL', 'en'));
select public.transition_booking(id, 'confirmed', 'partner', (select id from demo_me), null)
from demo_ids d join public.bookings b using (id) where b.guest_email = 'pieter.jansen@example.org';

-- Kastri (strict): one upcoming stay, two past reviews (too few for a rating).
insert into demo_ids select pg_temp.demo_book('32', 9, 3, pg_temp.party(3, 4),
  pg_temp.demo_guest('Dimitris Vlachos', 'dimitris.v@example.org', 'GR', 'el'), 'caravan');
insert into demo_ids select pg_temp.demo_stay('31', -50, 4, pg_temp.party(3, 2),
  pg_temp.demo_guest('Emma Johansson', 'emma.j@example.org', 'SE', 'en'), 'completed');
insert into demo_ids select pg_temp.demo_stay('32', -35, 3, pg_temp.party(3, 2, 1),
  pg_temp.demo_guest('Andreas Hoffmann', 'andreas.h@example.org', 'DE', 'en'), 'completed', null, null, 'camper');

-- Yours (My bookings): an upcoming stay, and a past one waiting for your review.
insert into demo_ids select pg_temp.demo_book('31', 15, 3, pg_temp.party(3, 2),
  pg_temp.demo_guest('You (demo)', (select email from demo_me), 'GR', 'el'), 'tent', '{}', (select id from demo_me));
insert into demo_ids select pg_temp.demo_stay('11', -12, 3, pg_temp.party(1, 2),
  pg_temp.demo_guest('You (demo)', (select email from demo_me), 'GR', 'el'), 'completed', null, (select id from demo_me));

insert into public.reviews (booking_id, camping_id, rating, body, locale, author_name, author_country, stay_month,
  partner_reply, partner_replied_at)
select b.id, b.camping_id, r.rating, r.body, r.locale, split_part(b.guest_name, ' ', 1), b.guest_country,
       date_trunc('month', b.arrival)::date, r.reply, case when r.reply is not null then now() end
from public.bookings b
join (values
  ('katerina.i@example.org', 5, 'Υπέροχο κάμπινγκ, καθαρά μπάνια και η θάλασσα στα δύο βήματα!', 'el', 'Ευχαριστούμε πολύ, σας περιμένουμε ξανά!'),
  ('jan.devries@example.org', 4, 'Lovely spot with plenty of shade. The wifi could be better.', 'en', null),
  ('maria.lopez@example.org', 5, 'The best beach of our trip and very friendly staff.', 'en', null),
  ('emma.j@example.org', 4, 'Beautiful sunsets from the terraces. Bring earplugs on weekends.', 'en', null),
  ('andreas.h@example.org', 3, 'Nice pool, but the pitches are small for a camper.', 'en', 'Thank you, we are adding larger pitches next season.')
) r (email, rating, body, locale, reply) on r.email = b.guest_email
where b.id in (select id from demo_ids);

-- No emails or pushes for demo bookings.
update public.notification_queue q set status = 'skipped', last_error = 'demo data'
where q.status = 'pending' and q.booking_id in (select id from demo_ids);

commit;

-- What was created:
select c.name, count(b.id) as bookings,
       count(b.id) filter (where b.status = 'requested') as requests,
       count(b.id) filter (where b.arrival = (now() at time zone 'Europe/Athens')::date) as arriving_today
from public.campings c left join public.bookings b on b.camping_id = c.id
where c.partner_id = 'd0000000-0000-4000-8000-0000000000d1'
group by c.name order by c.name;
