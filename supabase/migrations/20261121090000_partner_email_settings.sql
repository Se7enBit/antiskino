-- M7: partner members choose which booking emails they get (pushes are not
-- affected). profiles.muted_emails lists the kinds a member turned off;
-- claim_email_notifications() leaves those members out of the team's emails.

alter table public.profiles
  add column muted_emails text[] not null default '{}'
    check (muted_emails <@ array['booking_confirmed', 'request_received', 'booking_cancelled']);

-- The existing profiles_update_own policy limits updates to the user's own row.
grant update (muted_emails) on table public.profiles to authenticated;

-- As in 20261119120000_emails.sql, with the team's recipients filtered.
create or replace function public.claim_email_notifications(p_limit integer default 50)
returns table (id bigint, kind text, audience text, attempts integer, booking jsonb, recipients jsonb)
language sql
security definer
set search_path = ''
as $$
  update public.notification_queue q
  set status = 'skipped', last_error = 'stale'
  where q.status = 'pending' and q.channel = 'email' and q.created_at < now() - interval '1 day';

  with picked as (
    select q.id
    from public.notification_queue q
    join public.bookings b on b.id = q.booking_id
    where q.status = 'pending' and q.channel = 'email' and q.next_attempt_at <= now()
      and not (
        q.audience = 'guest' and b.manage_token_enc is null
        and b.created_at > now() - interval '2 minutes'
      )
    order by q.next_attempt_at, q.id
    limit greatest(1, least(p_limit, 500))
    for update of q skip locked
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
      'nights', b.nights, 'party_size', b.party_size, 'guest_name', b.guest_name,
      'total_cents', b.total_cents, 'payment_mode', b.payment_mode,
      'cancellation_policy', b.cancellation_policy, 'request_expires_at', b.request_expires_at,
      'cancel_reason', b.cancel_reason, 'manage_token_enc', b.manage_token_enc,
      'review_rating', (select r.rating from public.reviews r where r.booking_id = b.id),
      'pitch_type_name', pt.name,
      'camping', jsonb_build_object(
        'name', cp.name, 'address', cp.address, 'phone', cp.phone, 'email', cp.email,
        'lat', cp.lat, 'lng', cp.lng,
        'check_in_from', cp.check_in_from, 'check_out_until', cp.check_out_until
      )
    ),
    case c.audience
      when 'guest' then jsonb_build_array(jsonb_build_object('email', b.guest_email, 'locale', b.locale))
      else (
        select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'locale', coalesce(p.locale, 'el'))), '[]')
        from public.partner_members m
        join auth.users u on u.id = m.user_id
        left join public.profiles p on p.id = m.user_id
        where m.partner_id = cp.partner_id and u.email is not null
          and not (c.kind = any (coalesce(p.muted_emails, '{}')))
      )
    end
  from claimed c
  join public.bookings b on b.id = c.booking_id
  join public.campings cp on cp.id = b.camping_id
  join public.pitch_types pt on pt.id = b.pitch_type_id
  order by c.id;
$$;

revoke all on function public.claim_email_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_email_notifications(integer) to service_role;
