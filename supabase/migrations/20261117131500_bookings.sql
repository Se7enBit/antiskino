-- M4: bookings (SPEC §4.1, §4.3, §4.4, F3–F7, F10).
--
-- * reserve_and_create_booking() is the only way to create a booking. The
--   create-booking edge function calls it with the secret key after pricing
--   the stay on the server; it takes one pitch for every night atomically.
-- * transition_booking() is the only way to change a booking's status. It
--   checks the move, releases inventory, writes booking_events and queues the
--   notifications in the same transaction.
-- * API roles read bookings through RLS (never the manage token hash) and act
--   through the small wrappers at the end: the guest's manage link, a
--   signed-in guest's own bookings, partner accept / decline / cancel, and
--   claiming earlier bookings on sign-in.
-- * The notification_queue is sent by the notify edge function (emails need a
--   verified Resend domain; until then rows simply wait).

create type public.booking_status as enum (
  'held', 'requested', 'confirmed', 'declined', 'expired', 'cancelled', 'checked_in', 'completed', 'no_show'
);
create type public.booking_actor as enum ('guest', 'partner', 'admin', 'system');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- ANT- + 6 Crockford base32 characters
  ref text not null unique check (ref ~ '^ANT-[0-9A-HJKMNP-TV-Z]{6}$'),
  camping_id uuid not null references public.campings (id) on delete restrict,
  pitch_type_id uuid not null references public.pitch_types (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  guest_email extensions.citext not null
    check (guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(guest_email) <= 254),
  -- with the country code: +30 69…
  guest_phone text not null check (guest_phone ~ '^\+[0-9][0-9 ]{5,23}$'),
  -- ISO 3166-1 alpha-2
  guest_country text not null check (guest_country ~ '^[A-Z]{2}$'),
  locale text not null check (locale in ('el', 'en')),
  vehicle_plate text check (char_length(vehicle_plate) between 1 and 20),
  arrival_eta time,
  guest_note text check (char_length(guest_note) between 1 and 1000),
  arrival date not null,
  departure date not null,
  nights integer generated always as (departure - arrival) stored,
  equipment public.equipment not null,
  -- guests per category: {"<guest_category_id>": count}
  party jsonb not null check (jsonb_typeof(party) = 'object'),
  -- everyone, infants included (checked against max_people)
  party_size integer not null check (party_size between 1 and 50),
  -- {"<extra_id>": quantity}
  extras jsonb not null default '{}' check (jsonb_typeof(extras) = 'object'),
  status public.booking_status not null,
  hold_expires_at timestamptz,
  request_expires_at timestamptz,
  -- snapshot: never recomputed
  total_cents integer not null check (total_cents >= 0),
  price_breakdown jsonb not null,
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_mode public.payment_mode not null,
  due_online_cents integer not null default 0 check (due_online_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  cancellation_policy public.cancellation_policy not null,
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_cents integer not null check (commission_cents >= 0),
  assigned_pitch text check (char_length(assigned_pitch) between 1 and 40),
  internal_note text check (char_length(internal_note) between 1 and 2000),
  cancel_reason text check (char_length(cancel_reason) between 1 and 500),
  -- SHA-256 (hex) of the manage link token; the token itself is never stored
  manage_token_hash text not null check (manage_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_stay_length check (departure > arrival and departure - arrival <= 30),
  constraint bookings_request_has_deadline check (status <> 'requested' or request_expires_at is not null)
);

create index bookings_camping_arrival_idx on public.bookings (camping_id, arrival);
create index bookings_user_id_idx on public.bookings (user_id);
-- claim_bookings() looks bookings up by lower-cased email
create index bookings_unclaimed_email_idx on public.bookings (lower(guest_email::text)) where user_id is null;
create index bookings_open_requests_idx on public.bookings (request_expires_at) where status = 'requested';

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  actor_kind public.booking_actor not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  note text check (char_length(note) <= 500)
);

create index booking_events_booking_id_idx on public.booking_events (booking_id);

-- Messages to send. Addresses are looked up when sending, so no personal data
-- is copied here. audience: the booking's guest, or the camping's partner members.
create table public.notification_queue (
  id bigint generated always as identity primary key,
  kind text not null check (kind in (
    'booking_confirmed', 'request_received', 'request_declined', 'request_expired', 'booking_cancelled'
  )),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  audience text not null check (audience in ('guest', 'partner')),
  channel text not null check (channel in ('email', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_queue_pending_idx on public.notification_queue (next_attempt_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.athens_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Athens')::date;
$$;

create function public.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_text, 'UTF8')), 'hex');
$$;

-- ANT- + 6 random Crockford base32 characters, unused so far.
create function public.new_booking_ref()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea;
  v_ref text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_ref := 'ANT-';
    for i in 0..5 loop
      -- 256 is a multiple of 32, so every character is equally likely
      v_ref := v_ref || substr(v_alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.ref = v_ref);
  end loop;
  return v_ref;
end;
$$;

-- Queues the notifications of SPEC F10 for a booking that just reached p_status.
create function public.queue_booking_notifications(p_booking_id uuid, p_status public.booking_status)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_has_account boolean;
  v_kind text;
  v_rows text[];
begin
  select b.user_id is not null into v_has_account from public.bookings b where b.id = p_booking_id;
  -- audience:channel pairs
  case p_status
    when 'confirmed' then
      v_kind := 'booking_confirmed';
      v_rows := array['guest:email', 'guest:push', 'partner:email', 'partner:push'];
    when 'requested' then
      v_kind := 'request_received';
      v_rows := array['guest:email', 'partner:email', 'partner:push'];
    when 'declined' then
      v_kind := 'request_declined';
      v_rows := array['guest:email', 'guest:push'];
    when 'expired' then
      v_kind := 'request_expired';
      v_rows := array['guest:email', 'guest:push'];
    when 'cancelled' then
      v_kind := 'booking_cancelled';
      v_rows := array['guest:email', 'guest:push', 'partner:email', 'partner:push'];
    else
      return;
  end case;

  insert into public.notification_queue (kind, booking_id, audience, channel)
  select v_kind, p_booking_id, split_part(r, ':', 1), split_part(r, ':', 2)
  from unnest(v_rows) as r
  -- guests without an account have no device to push to
  where r <> 'guest:push' or v_has_account;
end;
$$;

create function public.record_booking_event(
  p_booking_id uuid,
  p_from public.booking_status,
  p_to public.booking_status,
  p_actor public.booking_actor,
  p_actor_user_id uuid,
  p_note text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.booking_events (booking_id, actor_kind, actor_user_id, from_status, to_status, note)
  values (p_booking_id, p_actor, p_actor_user_id, p_from, p_to, nullif(btrim(p_note), ''));
  perform public.queue_booking_notifications(p_booking_id, p_to);
end;
$$;

-- ---------------------------------------------------------------------------
-- Creating a booking
-- ---------------------------------------------------------------------------

-- Errors: P0002 unknown pitch type; 22023 bad party or extras;
-- ANT01 not sellable (rules of SPEC §4.1) or sold out meanwhile.
create function public.reserve_and_create_booking(
  p_pitch_type_id uuid,
  p_arrival date,
  p_departure date,
  p_equipment public.equipment,
  -- {"<guest_category_id>": count}
  p_party jsonb,
  -- {"<extra_id>": quantity}
  p_extras jsonb,
  -- {name, email, phone, country, locale, vehicle_plate?, arrival_eta?, note?}
  p_guest jsonb,
  p_user_id uuid,
  p_total_cents integer,
  p_price_breakdown jsonb,
  p_manage_token_hash text
)
returns table (booking_id uuid, ref text, status public.booking_status, request_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camping public.campings%rowtype;
  v_commission_bps integer;
  v_party_size integer;
  v_nights integer := p_departure - p_arrival;
  v_taken integer;
  v_status public.booking_status;
  v_deadline timestamptz;
  v_booking_id uuid;
  v_ref text;
begin
  select c.* into v_camping
  from public.pitch_types pt join public.campings c on c.id = pt.camping_id
  where pt.id = p_pitch_type_id;
  if not found then
    raise exception 'pitch type % not found', p_pitch_type_id using errcode = 'P0002';
  end if;

  -- The party: positive counts of this camping's guest categories.
  if jsonb_typeof(p_party) is distinct from 'object' or exists (
    select 1 from jsonb_each(p_party) e
    where jsonb_typeof(e.value) <> 'number'
      or (e.value)::numeric <> trunc((e.value)::numeric)
      or (e.value)::int < 1
      or not exists (
        select 1 from public.guest_categories gc
        where gc.id::text = e.key and gc.camping_id = v_camping.id
      )
  ) then
    raise exception 'invalid party' using errcode = '22023';
  end if;
  select coalesce(sum((e.value)::int), 0) into v_party_size from jsonb_each(p_party) e;

  -- Extras: active extras of this camping, 1 up to their maximum.
  if jsonb_typeof(p_extras) is distinct from 'object' or exists (
    select 1 from jsonb_each(p_extras) e
    where jsonb_typeof(e.value) <> 'number'
      or (e.value)::numeric <> trunc((e.value)::numeric)
      or not exists (
        select 1 from public.extras x
        where x.id::text = e.key and x.camping_id = v_camping.id and x.active
          and (e.value)::int between 1 and x.max_qty
      )
  ) then
    raise exception 'invalid extras' using errcode = '22023';
  end if;

  -- The same rules as search (live, active, equipment, capacity, seasons,
  -- minimum nights, same-day cutoff, open nights with room).
  if not exists (
    select 1
    from public.sellable_pitch_types_at(now(), p_arrival, p_departure, p_equipment, v_party_size, v_camping.id) s
    where s.pitch_type_id = p_pitch_type_id
  ) then
    raise exception 'not available' using errcode = 'ANT01';
  end if;

  -- Take one pitch every night, all or nothing. Lock the nights in order
  -- first, so concurrent bookings queue up instead of deadlocking.
  perform 1 from public.inventory_nights n
  where n.pitch_type_id = p_pitch_type_id and n.night >= p_arrival and n.night < p_departure
  order by n.night
  for update;
  update public.inventory_nights n
  set booked = n.booked + 1
  where n.pitch_type_id = p_pitch_type_id
    and n.night >= p_arrival and n.night < p_departure
    and not n.closed
    and n.booked < n.allotment;
  get diagnostics v_taken = row_count;
  if v_taken <> v_nights then
    -- the whole transaction rolls back, undoing the nights already taken
    raise exception 'sold out' using errcode = 'ANT01';
  end if;

  select coalesce(p.commission_bps, s.default_commission_bps) into v_commission_bps
  from public.partners p, public.platform_settings s
  where p.id = v_camping.partner_id and s.id = 1;

  if v_camping.confirmation_mode = 'request' then
    v_status := 'requested';
    v_deadline := now() + make_interval(hours => v_camping.request_expiry_hours);
  else
    v_status := 'confirmed';
  end if;
  v_ref := public.new_booking_ref();

  insert into public.bookings (
    ref, camping_id, pitch_type_id, user_id,
    guest_name, guest_email, guest_phone, guest_country, locale,
    vehicle_plate, arrival_eta, guest_note,
    arrival, departure, equipment, party, party_size, extras,
    status, request_expires_at,
    total_cents, price_breakdown, payment_mode, due_online_cents,
    cancellation_policy, commission_bps, commission_cents, manage_token_hash
  ) values (
    v_ref, v_camping.id, p_pitch_type_id, p_user_id,
    btrim(p_guest ->> 'name'), btrim(p_guest ->> 'email'), btrim(p_guest ->> 'phone'),
    p_guest ->> 'country', p_guest ->> 'locale',
    nullif(btrim(p_guest ->> 'vehicle_plate'), ''), (nullif(p_guest ->> 'arrival_eta', ''))::time,
    nullif(btrim(p_guest ->> 'note'), ''),
    p_arrival, p_departure, p_equipment, p_party, v_party_size, p_extras,
    v_status, v_deadline,
    p_total_cents, p_price_breakdown, v_camping.payment_mode, 0,
    v_camping.cancellation_policy, v_commission_bps,
    -- round half up, integer math
    ((p_total_cents::bigint * v_commission_bps + 5000) / 10000)::integer,
    p_manage_token_hash
  )
  returning bookings.id into v_booking_id;

  perform public.record_booking_event(v_booking_id, null, v_status, 'guest', p_user_id, null);
  return query select v_booking_id, v_ref, v_status, v_deadline;
end;
$$;

-- ---------------------------------------------------------------------------
-- Changing a booking's status (SPEC §4.3)
-- ---------------------------------------------------------------------------

-- Errors: P0002 unknown booking; ANT02 the move isn't allowed from the current status.
create function public.transition_booking(
  p_booking_id uuid,
  p_to public.booking_status,
  p_actor public.booking_actor,
  p_actor_user_id uuid,
  p_note text
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;

  if not (case v_booking.status
    when 'held' then p_to in ('confirmed', 'expired', 'cancelled')
    when 'requested' then p_to in ('confirmed', 'declined', 'expired', 'cancelled')
    when 'confirmed' then p_to in ('cancelled', 'checked_in', 'no_show', 'completed')
    when 'checked_in' then p_to = 'completed'
    else false
  end) then
    raise exception 'a % booking cannot become %', v_booking.status, p_to using errcode = 'ANT02';
  end if;

  -- Give the nights back when a booking that holds them ends early.
  if p_to in ('declined', 'expired', 'cancelled') then
    update public.inventory_nights n
    set booked = n.booked - 1
    where n.pitch_type_id = v_booking.pitch_type_id
      and n.night >= v_booking.arrival and n.night < v_booking.departure;
  end if;

  update public.bookings b
  set status = p_to,
      cancel_reason = case when p_to = 'cancelled' then nullif(btrim(p_note), '') else b.cancel_reason end
  where b.id = p_booking_id;

  perform public.record_booking_event(p_booking_id, v_booking.status, p_to, p_actor, p_actor_user_id, p_note);
  return p_to;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guests: the manage link (/m?ref=…&t=…), no account needed
-- ---------------------------------------------------------------------------

-- A guest may cancel until the end of the arrival day (refunds follow the
-- policy; nothing to refund when paying at reception).
create function public.guest_can_cancel(p_status public.booking_status, p_arrival date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status in ('requested', 'confirmed') and p_arrival >= public.athens_today();
$$;

-- The booking behind a manage link, or null for a wrong ref or token.
create function public.guest_booking(p_ref text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ref', b.ref,
    'status', b.status,
    'can_cancel', public.guest_can_cancel(b.status, b.arrival),
    'arrival', b.arrival,
    'departure', b.departure,
    'nights', b.nights,
    'equipment', b.equipment,
    'party', b.party,
    'extras', b.extras,
    'total_cents', b.total_cents,
    'price_breakdown', b.price_breakdown,
    'payment_mode', b.payment_mode,
    'cancellation_policy', b.cancellation_policy,
    'request_expires_at', b.request_expires_at,
    'cancel_reason', b.cancel_reason,
    'created_at', b.created_at,
    'guest', jsonb_build_object(
      'name', b.guest_name, 'email', b.guest_email, 'phone', b.guest_phone, 'country', b.guest_country,
      'locale', b.locale, 'vehicle_plate', b.vehicle_plate, 'arrival_eta', b.arrival_eta, 'note', b.guest_note
    ),
    'camping', jsonb_build_object(
      'name', c.name, 'slug', c.slug, 'address', c.address, 'lat', c.lat, 'lng', c.lng,
      'phone', c.phone, 'email', c.email,
      'check_in_from', c.check_in_from, 'check_out_until', c.check_out_until
    ),
    'pitch_type', jsonb_build_object('id', pt.id, 'name', pt.name),
    -- names for the party, extras and fee lines (hidden ones included)
    'names', jsonb_build_object(
      'guest', (select coalesce(jsonb_object_agg(gc.id, gc.name), '{}') from public.guest_categories gc where gc.camping_id = c.id),
      'extra', (select coalesce(jsonb_object_agg(x.id, x.name), '{}') from public.extras x where x.camping_id = c.id),
      'fee', (select coalesce(jsonb_object_agg(f.id, f.name), '{}') from public.fees f where f.camping_id = c.id)
    )
  )
  from public.bookings b
  join public.campings c on c.id = b.camping_id
  join public.pitch_types pt on pt.id = b.pitch_type_id
  where b.ref = upper(btrim(p_ref))
    and b.manage_token_hash = public.sha256_hex(p_token);
$$;

-- Errors: P0002 wrong ref or token; ANT02 no longer cancellable.
create function public.guest_cancel_booking(p_ref text, p_token text)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings b
  where b.ref = upper(btrim(p_ref)) and b.manage_token_hash = public.sha256_hex(p_token);
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.guest_can_cancel(v_booking.status, v_booking.arrival) then
    raise exception 'this booking can no longer be cancelled' using errcode = 'ANT02';
  end if;
  return public.transition_booking(v_booking.id, 'cancelled', 'guest', auth.uid(), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Signed-in guests
-- ---------------------------------------------------------------------------

-- Attaches the bookings made with the user's verified email (SPEC F7).
create function public.claim_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer;
begin
  select u.email into v_email from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;
  -- (citext's case-insensitive = isn't visible with an empty search_path)
  update public.bookings b set user_id = auth.uid()
  where b.user_id is null and lower(b.guest_email::text) = lower(v_email);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Errors: P0002 not one of the user's bookings; ANT02 no longer cancellable.
create function public.cancel_my_booking(p_booking_id uuid)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings b
  where b.id = p_booking_id and b.user_id = auth.uid() and auth.uid() is not null;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.guest_can_cancel(v_booking.status, v_booking.arrival) then
    raise exception 'this booking can no longer be cancelled' using errcode = 'ANT02';
  end if;
  return public.transition_booking(v_booking.id, 'cancelled', 'guest', auth.uid(), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Partners (owners and staff) and admins
-- ---------------------------------------------------------------------------

-- p_action: accept / decline a request, or cancel (a reason is required).
-- Errors: 42501 not the camping's team; P0002 unknown booking; 22023 bad
-- action or missing reason; ANT02 not allowed from the current status.
create function public.partner_booking_action(p_booking_id uuid, p_action text, p_note text)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_member boolean;
  v_to public.booking_status;
begin
  select * into v_booking from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  v_member := public.is_partner_member(public.camping_partner(v_booking.camping_id));
  if not (v_member or public.is_admin()) then
    raise exception 'only the camping''s team can act on its bookings' using errcode = '42501';
  end if;

  v_to := case p_action
    when 'accept' then 'confirmed'::public.booking_status
    when 'decline' then 'declined'
    when 'cancel' then 'cancelled'
  end;
  if v_to is null then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if p_action in ('accept', 'decline') and v_booking.status <> 'requested' then
    raise exception 'only requests can be accepted or declined' using errcode = 'ANT02';
  end if;
  if p_action = 'cancel' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'a reason is required to cancel' using errcode = '22023';
  end if;

  return public.transition_booking(
    p_booking_id, v_to, case when v_member then 'partner' else 'admin' end::public.booking_actor, auth.uid(), p_note
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs (scheduled with pg_cron in a later migration)
-- ---------------------------------------------------------------------------

-- Requests (and, from M7, holds) past their deadline expire and give the nights back.
create function public.expire_overdue_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select b.id from public.bookings b
    where (b.status = 'requested' and b.request_expires_at <= now())
       or (b.status = 'held' and b.hold_expires_at <= now())
    order by b.id
  loop
    perform public.transition_booking(v_id, 'expired', 'system', null, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Stays whose departure day has passed are completed.
create function public.complete_past_stays()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select b.id from public.bookings b
    where b.status in ('confirmed', 'checked_in') and b.departure < public.athens_today()
    order by b.id
  loop
    perform public.transition_booking(v_id, 'completed', 'system', null, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.notification_queue enable row level security;

revoke all on table public.bookings, public.booking_events, public.notification_queue from anon, authenticated;
grant select, insert, update, delete on table public.bookings, public.booking_events, public.notification_queue
  to service_role;

-- Everything but the manage token hash. No insert/update/delete: writes go
-- through the functions above.
grant select (
  id, ref, camping_id, pitch_type_id, user_id,
  guest_name, guest_email, guest_phone, guest_country, locale, vehicle_plate, arrival_eta, guest_note,
  arrival, departure, nights, equipment, party, party_size, extras,
  status, hold_expires_at, request_expires_at,
  total_cents, price_breakdown, currency, payment_mode, due_online_cents, paid_cents, refunded_cents,
  cancellation_policy, commission_bps, commission_cents,
  assigned_pitch, internal_note, cancel_reason, created_at, updated_at
) on table public.bookings to authenticated;
grant select on table public.booking_events to authenticated;

-- A guest's own bookings, the camping team's bookings, or all for admins.
create policy bookings_select_own_member_or_admin
  on public.bookings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

-- Events of the bookings one can read (the subquery applies bookings' RLS).
create policy booking_events_select_readable_booking
  on public.booking_events for select
  to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

-- Function privileges: internal ones for the secret key only; wrappers for the API roles.
revoke all on function public.athens_today() from public, anon, authenticated;
revoke all on function public.sha256_hex(text) from public, anon, authenticated;
revoke all on function public.new_booking_ref() from public, anon, authenticated;
revoke all on function public.queue_booking_notifications(uuid, public.booking_status) from public, anon, authenticated;
revoke all on function public.record_booking_event(uuid, public.booking_status, public.booking_status, public.booking_actor, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reserve_and_create_booking(uuid, date, date, public.equipment, jsonb, jsonb, jsonb, uuid, integer, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.transition_booking(uuid, public.booking_status, public.booking_actor, uuid, text)
  from public, anon, authenticated;
revoke all on function public.guest_can_cancel(public.booking_status, date) from public, anon, authenticated;
revoke all on function public.guest_booking(text, text) from public;
revoke all on function public.guest_cancel_booking(text, text) from public;
revoke all on function public.claim_bookings() from public, anon;
revoke all on function public.cancel_my_booking(uuid) from public, anon;
revoke all on function public.partner_booking_action(uuid, text, text) from public, anon;
revoke all on function public.expire_overdue_bookings() from public, anon, authenticated;
revoke all on function public.complete_past_stays() from public, anon, authenticated;

grant execute on function public.reserve_and_create_booking(uuid, date, date, public.equipment, jsonb, jsonb, jsonb, uuid, integer, jsonb, text)
  to service_role;
grant execute on function public.transition_booking(uuid, public.booking_status, public.booking_actor, uuid, text)
  to service_role;
grant execute on function public.expire_overdue_bookings() to service_role;
grant execute on function public.complete_past_stays() to service_role;
grant execute on function public.guest_booking(text, text) to anon, authenticated, service_role;
grant execute on function public.guest_cancel_booking(text, text) to anon, authenticated, service_role;
grant execute on function public.claim_bookings() to authenticated, service_role;
grant execute on function public.cancel_my_booking(uuid) to authenticated, service_role;
grant execute on function public.partner_booking_action(uuid, text, text) to authenticated, service_role;
