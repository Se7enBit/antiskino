-- M4 carry-over: sending the queued emails (SPEC F10).
--
-- * The manage link's token is shown once and only its hash is kept. For guest
--   emails to carry the link, create-booking now also stores the token
--   encrypted (manage_token_enc) with a key only edge functions hold; no app
--   role can read the column.
-- * The notify function claims due emails with claim_email_notifications(),
--   sends them with Resend and reports each outcome with finish_notification().
-- * Emails queued before sending existed are skipped, so nobody gets a pile of
--   old messages; later, emails queued over a day ago are skipped too.

alter table public.bookings
  add column manage_token_enc text check (char_length(manage_token_enc) between 20 and 500);
-- Not added to the column grants of authenticated: only the secret key reads it.

-- create-booking stores the encrypted token right after the reservation.
create function public.store_manage_token(p_booking_id uuid, p_enc text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings b set manage_token_enc = p_enc
  where b.id = p_booking_id and b.manage_token_enc is null;
$$;

update public.notification_queue q
set status = 'skipped', last_error = 'queued before emails were sent'
where q.channel = 'email' and q.status = 'pending';

-- Like claim_push_notifications(), for emails: the booking with what the email
-- shows, and the addresses — the guest's in the booking's language, or the
-- team's in each member's language. A guest email waits up to 2 minutes for
-- create-booking to store the link's token.
create function public.claim_email_notifications(p_limit integer default 50)
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
      )
    end
  from claimed c
  join public.bookings b on b.id = c.booking_id
  join public.campings cp on cp.id = b.camping_id
  join public.pitch_types pt on pt.id = b.pitch_type_id
  order by c.id;
$$;

-- The outcome of a claimed push or email: 'sent', 'skipped', or anything else
-- to retry. The fifth failed attempt is final.
create function public.finish_notification(p_id bigint, p_outcome text, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_queue q
  set status = case
        when p_outcome in ('sent', 'skipped') then p_outcome
        when q.attempts >= 5 then 'failed'
        else 'pending'
      end,
      sent_at = case when p_outcome = 'sent' then now() else q.sent_at end,
      last_error = left(p_error, 500)
  where q.id = p_id and q.status = 'pending';
$$;

-- notify is now called when pushes or emails are due.
create or replace function public.invoke_notify()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.notification_queue q
    where q.status = 'pending' and q.next_attempt_at <= now()
      -- emails queued over a day ago are skipped anyway
      and (q.channel = 'push' or q.created_at > now() - interval '1 day')
  ) then
    return null;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'notify_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/notify',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.store_manage_token(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_email_notifications(integer) from public, anon, authenticated;
revoke all on function public.finish_notification(bigint, text, text) from public, anon, authenticated;
grant execute on function public.store_manage_token(uuid, text) to service_role;
grant execute on function public.claim_email_notifications(integer) to service_role;
grant execute on function public.finish_notification(bigint, text, text) to service_role;
