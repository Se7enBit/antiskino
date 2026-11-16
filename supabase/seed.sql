-- Local development data, applied by `supabase db reset` / `supabase start`.
-- Not applied to the hosted projects.
--
-- Demo users for signing in with an email code against the local stack
-- (codes land in Mailpit at http://127.0.0.1:54324):
--   admin@antiskino.test  platform admin
--   owner@antiskino.test  owner of the demo partner
--   guest@antiskino.test  camper
-- plus a demo partner (owned by owner@) with one live camping, two pitch types,
-- the 2027 seasons, prices and inventory.

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('locale', u.locale), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@antiskino.test', 'el'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'owner@antiskino.test', 'el'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'guest@antiskino.test', 'en')
) as u (id, email, locale);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email like '%@antiskino.test';

-- Profiles were created by the on_auth_user_created trigger.
update public.profiles set full_name = 'Antiskino Admin', is_platform_admin = true
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set full_name = 'Demo Owner', country = 'GR'
where id = 'a0000000-0000-4000-8000-000000000002';

update public.profiles set full_name = 'Demo Guest', country = 'DE'
where id = 'a0000000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Demo partner and camping
-- ---------------------------------------------------------------------------

insert into public.partners (id, name, legal_name, billing_email) values
  ('b0000000-0000-4000-8000-000000000001', 'Demo Campings', 'Demo Campings IKE', 'billing@antiskino.test');

insert into public.partner_members (partner_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'owner');

insert into public.campings (
  id, partner_id, slug, status, name, short_descr, descr, house_rules,
  region, address, lat, lng, phone, email, amenities,
  check_in_from, check_out_until, confirmation_mode, cancellation_policy
) values (
  'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'demo-thalassa', 'live', 'Camping Thalassa (demo)',
  '{"el": "Σκιερές θέσεις δίπλα στη θάλασσα.", "en": "Shady pitches right by the sea."}',
  '{"el": "Ένα ήσυχο κάμπινγκ για δοκιμές, με πεύκα και αμμουδιά.", "en": "A quiet camping for testing, with pine trees and a sandy beach."}',
  '{"el": "Ησυχία 23:00-08:00.", "en": "Quiet hours 23:00-08:00."}',
  'Halkidiki', 'Sarti, Sithonia, 630 72 Halkidiki', 40.0915, 23.9800, '+30 2375 000000', 'info@antiskino.test',
  '{hot_showers,electricity,wifi,beach_access,mini_market,shade,pets_allowed}',
  '14:00', '12:00', 'instant', 'moderate'
);

insert into public.pitch_types (id, camping_id, name, included, accepts, max_people, size_m2, sort) values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Θέση σκηνής", "en": "Tent pitch"}',
   '{"el": "Ντους και κοινόχρηστοι χώροι", "en": "Showers and shared facilities"}',
   '{tent}', 4, 50, 1),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Θέση τροχόσπιτου / αυτοκινούμενου με ρεύμα", "en": "Caravan / camper pitch with electricity"}',
   '{"el": "Ρεύμα 6A, ντους και κοινόχρηστοι χώροι", "en": "6A electricity, showers and shared facilities"}',
   '{caravan,camper}', 6, 80, 2);

insert into public.seasons (id, camping_id, name, dates, min_nights) values
  ('c2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Χαμηλή περίοδος", "en": "Low season"}', '[2027-05-01,2027-07-01)', 1),
  ('c2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Υψηλή περίοδος", "en": "High season"}', '[2027-07-01,2027-09-01)', 3),
  ('c2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Σεπτέμβριος", "en": "September"}', '[2027-09-01,2027-10-01)', 1);

insert into public.guest_categories (id, camping_id, name, min_age, max_age, sort) values
  ('c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Ενήλικας (12+)", "en": "Adult (12+)"}', 12, null, 1),
  ('c3000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Παιδί (4-11)", "en": "Child (4-11)"}', 4, 11, 2),
  ('c3000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Βρέφος (0-3)", "en": "Infant (0-3)"}', 0, 3, 3);

insert into public.extras (id, camping_id, name, unit, max_qty, sort) values
  ('c4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Αυτοκίνητο", "en": "Car"}', 'per_night', 2, 1),
  ('c4000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Μοτοσικλέτα", "en": "Motorbike"}', 'per_night', 2, 2),
  ('c4000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Κατοικίδιο", "en": "Pet"}', 'per_night', 2, 3),
  ('c4000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Επιπλέον σκηνή", "en": "Extra tent"}', 'per_night', 1, 4),
  ('c4000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Ρεύμα (θέση σκηνής)", "en": "Electricity (tent pitch)"}', 'per_night', 1, 5),
  ('c4000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   '{"el": "Καθαρισμός στο τέλος", "en": "Final cleaning"}', 'per_stay', 1, 6);

-- Prices in cents: (item_type, item_id, low, high); September uses the low prices.
insert into public.prices (season_id, item_type, item_id, amount_cents)
select s.id, p.item_type::public.price_item_type, p.item_id::uuid,
       case when s.id = 'c2000000-0000-4000-8000-000000000002' then p.high else p.low end
from public.seasons s
cross join (values
  ('pitch', 'c1000000-0000-4000-8000-000000000001', 1000, 1500),
  ('pitch', 'c1000000-0000-4000-8000-000000000002', 1600, 2400),
  ('guest', 'c3000000-0000-4000-8000-000000000001', 700, 950),
  ('guest', 'c3000000-0000-4000-8000-000000000002', 400, 550),
  ('guest', 'c3000000-0000-4000-8000-000000000003', 0, 0),
  ('extra', 'c4000000-0000-4000-8000-000000000001', 300, 400),
  ('extra', 'c4000000-0000-4000-8000-000000000002', 200, 250),
  ('extra', 'c4000000-0000-4000-8000-000000000003', 200, 300),
  ('extra', 'c4000000-0000-4000-8000-000000000004', 400, 500),
  ('extra', 'c4000000-0000-4000-8000-000000000005', 450, 500),
  ('extra', 'c4000000-0000-4000-8000-000000000006', 1500, 1500)
) as p (item_type, item_id, low, high)
where s.camping_id = 'c0000000-0000-4000-8000-000000000001';

-- Inventory for the whole 2027 season, set the same way the owner would.
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}', false);
select public.set_allotment('c1000000-0000-4000-8000-000000000001', '2027-05-01', '2027-09-30', 10);
select public.set_allotment('c1000000-0000-4000-8000-000000000002', '2027-05-01', '2027-09-30', 6);
select set_config('request.jwt.claims', '', false);
