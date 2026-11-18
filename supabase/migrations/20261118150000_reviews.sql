-- M6: reviews (SPEC F9), review invites and arrival reminders (SPEC §4.5).
--
-- * Only completed bookings can be reviewed, once. The guest writes through
--   submit_my_review() (signed in) or guest_submit_review() (manage link).
-- * A review keeps what it shows: the guest's first name, country and month of
--   stay are copied in when it is written, so the public never reads bookings.
-- * The camping's team posts one public reply (reply_to_review(), editable);
--   the admin hides or shows a review with a reason (set_review_hidden()).
-- * camping_ratings: the average of visible reviews per camping (shown from 3).
-- * An hourly job queues, from 10:00 Athens time, arrival reminders (arrival in
--   2 days) and review invites (stays completed since yesterday).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  camping_id uuid not null references public.campings (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) between 1 and 1000),
  locale text not null check (locale in ('el', 'en')),
  author_name text not null check (char_length(author_name) between 1 and 60),
  author_country text not null,
  stay_month date not null,
  partner_reply text check (char_length(partner_reply) between 1 and 1000),
  partner_replied_at timestamptz,
  hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) between 3 and 500),
  created_at timestamptz not null default now()
);

create index reviews_camping_id_idx on public.reviews (camping_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;
-- The public sees what a review shows; never who wrote it (user_id) or why it was hidden.
-- (`hidden` is always false in what anon can read; camping_ratings filters on it.)
grant select (
  id, camping_id, rating, body, locale, author_name, author_country, stay_month,
  partner_reply, partner_replied_at, hidden, created_at
) on table public.reviews to anon;
grant select (
  id, booking_id, camping_id, rating, body, locale, author_name, author_country, stay_month,
  partner_reply, partner_replied_at, hidden, hidden_reason, created_at
) on table public.reviews to authenticated;
grant select, insert, update, delete on table public.reviews to service_role;

-- Visible reviews of live campings for everyone; all of a camping's reviews for its team; all for admins.
create policy reviews_select_visible_member_or_admin
  on public.reviews for select
  to anon, authenticated
  using (
    (not hidden and public.camping_is_live(camping_id))
    or public.is_partner_member(public.camping_partner(camping_id))
    or public.is_admin()
  );

-- The rating of each camping with visible reviews (RLS of reviews applies).
create view public.camping_ratings
with (security_invoker = true)
as
  select r.camping_id, count(*)::integer as review_count, round(avg(r.rating), 1) as rating_avg
  from public.reviews r
  where not r.hidden
  group by r.camping_id;

revoke all on table public.camping_ratings from anon, authenticated;
grant select on table public.camping_ratings to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Notifications: three more kinds
-- ---------------------------------------------------------------------------

alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check check (kind in (
  'booking_confirmed', 'request_received', 'request_declined', 'request_expired', 'booking_cancelled',
  'request_expiring', 'arrival_reminder', 'review_invite', 'review_received'
));

-- ---------------------------------------------------------------------------
-- Writing a review
-- ---------------------------------------------------------------------------

-- A booking can be reviewed once its stay is completed, if it has no review yet.
create function public.can_review(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.status = 'completed'
      and not exists (select 1 from public.reviews r where r.booking_id = b.id)
  );
$$;

-- Internal: writes the review of a booking and tells the camping's team.
-- Errors: ANT03 cannot be reviewed (not completed, or already reviewed);
-- 22023 bad rating or text.
create function public.create_review(p_booking_id uuid, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found or not public.can_review(p_booking_id) then
    raise exception 'this stay cannot be reviewed' using errcode = 'ANT03';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating must be 1 to 5' using errcode = '22023';
  end if;
  if char_length(v_body) > 1000 then
    raise exception 'review text is too long' using errcode = '22023';
  end if;

  insert into public.reviews (
    booking_id, camping_id, user_id, rating, body, locale, author_name, author_country, stay_month
  ) values (
    v_booking.id, v_booking.camping_id, v_booking.user_id, p_rating, v_body,
    case when v_booking.locale = 'en' then 'en' else 'el' end,
    left(split_part(btrim(v_booking.guest_name), ' ', 1), 60),
    v_booking.guest_country,
    date_trunc('month', v_booking.arrival)::date
  )
  returning id into v_id;

  insert into public.notification_queue (kind, booking_id, audience, channel)
  values ('review_received', v_booking.id, 'partner', 'push');
  return v_id;
end;
$$;

-- The signed-in guest reviews one of their bookings.
create function public.submit_my_review(p_booking_id uuid, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.bookings b where b.id = p_booking_id and b.user_id = auth.uid()
  ) then
    raise exception 'not your booking' using errcode = '42501';
  end if;
  return public.create_review(p_booking_id, p_rating, p_body);
end;
$$;

-- A guest reviews with the manage link (no account needed).
create function public.guest_submit_review(p_ref text, p_token text, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select b.id into v_id from public.bookings b
  where b.ref = upper(btrim(p_ref)) and b.manage_token_hash = public.sha256_hex(p_token);
  if v_id is null then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  return public.create_review(v_id, p_rating, p_body);
end;
$$;

-- ---------------------------------------------------------------------------
-- Replies and moderation
-- ---------------------------------------------------------------------------

-- The camping's public reply (owner or staff). Empty text removes it.
create function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camping_id uuid;
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  select r.camping_id into v_camping_id from public.reviews r where r.id = p_review_id;
  if v_camping_id is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  if not (public.is_partner_member(public.camping_partner(v_camping_id)) or public.is_admin()) then
    raise exception 'only the camping''s team can reply' using errcode = '42501';
  end if;
  if char_length(v_reply) > 1000 then
    raise exception 'reply is too long' using errcode = '22023';
  end if;
  update public.reviews r
  set partner_reply = v_reply, partner_replied_at = case when v_reply is null then null else now() end
  where r.id = p_review_id;
end;
$$;

-- Admin only: hide a review (a reason is required) or show it again.
create function public.set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'only admins moderate reviews' using errcode = '42501';
  end if;
  if p_hidden and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'a reason is required to hide a review' using errcode = '22023';
  end if;
  update public.reviews r
  set hidden = p_hidden, hidden_reason = case when p_hidden then v_reason end
  where r.id = p_review_id;
  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The guest's view of a booking: can it be reviewed, and its review
-- ---------------------------------------------------------------------------

create or replace function public.booking_view(p_booking_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ref', b.ref,
    'status', b.status,
    'can_cancel', public.guest_can_cancel(b.status, b.arrival),
    'can_review', public.can_review(b.id),
    'review', (
      select jsonb_build_object(
        'rating', r.rating, 'body', r.body, 'partner_reply', r.partner_reply, 'hidden', r.hidden
      )
      from public.reviews r where r.booking_id = b.id
    ),
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
  where b.id = p_booking_id;
$$;

-- ---------------------------------------------------------------------------
-- Daily guest messages (§4.5), from 10:00 Athens time
-- ---------------------------------------------------------------------------

-- Runs hourly; does nothing before 10:00 in Athens, so it follows summer time.
-- Each booking gets each message once (email always, push with an account).
-- p_now is for tests.
create function public.queue_daily_guest_messages(p_now timestamptz default now())
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Europe/Athens')::date;
  v_count integer;
begin
  if extract(hour from p_now at time zone 'Europe/Athens') < 10 then
    return 0;
  end if;
  with due as (
    select b.id, 'arrival_reminder' as kind, b.user_id
    from public.bookings b
    where b.status = 'confirmed' and b.arrival = v_today + 2
    union all
    -- completed at night after departure; catch up two more days if the job was down
    select b.id, 'review_invite', b.user_id
    from public.bookings b
    where b.status = 'completed' and b.departure between v_today - 3 and v_today - 1
      and not exists (select 1 from public.reviews r where r.booking_id = b.id)
  ),
  queued as (
    insert into public.notification_queue (kind, booking_id, audience, channel)
    select d.kind, d.id, 'guest', ch.channel
    from due d
    cross join (values ('email'), ('push')) as ch(channel)
    where (ch.channel = 'email' or d.user_id is not null)
      and not exists (
        select 1 from public.notification_queue q where q.booking_id = d.id and q.kind = d.kind
      )
    returning 1
  )
  select count(*)::integer into v_count from queued;
  return v_count;
end;
$$;

-- Push claims also say whether the stay has been reviewed, and with what rating.
create or replace function public.claim_push_notifications(p_limit integer default 50)
returns table (id bigint, kind text, audience text, attempts integer, booking jsonb, recipients jsonb)
language sql
security definer
set search_path = ''
as $$
  update public.notification_queue q
  set status = 'skipped', last_error = 'stale'
  where q.status = 'pending' and q.channel = 'push' and q.created_at < now() - interval '2 hours';

  with picked as (
    select q.id
    from public.notification_queue q
    where q.status = 'pending' and q.channel = 'push' and q.next_attempt_at <= now()
    order by q.next_attempt_at, q.id
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  ),
  claimed as (
    update public.notification_queue q
    set attempts = q.attempts + 1,
        next_attempt_at = now() + make_interval(mins => 5 * (q.attempts + 1))
    from picked
    where q.id = picked.id
    returning q.id, q.kind, q.audience, q.attempts, q.booking_id
  )
  select
    c.id, c.kind, c.audience, c.attempts,
    jsonb_build_object(
      'ref', b.ref, 'status', b.status, 'arrival', b.arrival, 'departure', b.departure,
      'guest_name', b.guest_name, 'camping_name', cp.name, 'request_expires_at', b.request_expires_at,
      'review_rating', (select r.rating from public.reviews r where r.booking_id = b.id)
    ),
    case c.audience
      when 'guest' then (
        select coalesce(jsonb_agg(jsonb_build_object('token', t.token, 'locale', b.locale)), '[]')
        from public.push_tokens t
        where t.user_id = b.user_id
      )
      else (
        select coalesce(jsonb_agg(jsonb_build_object('token', t.token, 'locale', coalesce(p.locale, 'el'))), '[]')
        from public.partner_members m
        join public.push_tokens t on t.user_id = m.user_id
        left join public.profiles p on p.id = m.user_id
        where m.partner_id = cp.partner_id
      )
    end
  from claimed c
  join public.bookings b on b.id = c.booking_id
  join public.campings cp on cp.id = b.camping_id
  order by c.id;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and jobs
-- ---------------------------------------------------------------------------

revoke all on function public.can_review(uuid) from public, anon, authenticated;
revoke all on function public.create_review(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.submit_my_review(uuid, integer, text) from public, anon;
revoke all on function public.guest_submit_review(text, text, integer, text) from public;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
revoke all on function public.set_review_hidden(uuid, boolean, text) from public, anon;
revoke all on function public.queue_daily_guest_messages(timestamptz) from public, anon, authenticated;
grant execute on function public.submit_my_review(uuid, integer, text) to authenticated, service_role;
grant execute on function public.guest_submit_review(text, text, integer, text) to anon, authenticated, service_role;
grant execute on function public.reply_to_review(uuid, text) to authenticated, service_role;
grant execute on function public.set_review_hidden(uuid, boolean, text) to authenticated, service_role;

select cron.schedule('queue-daily-guest-messages', '5 * * * *', 'select public.queue_daily_guest_messages()');
