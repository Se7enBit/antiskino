-- M5: push delivery (SPEC F10).
--
-- notification_queue already holds a row per message (M4). Every minute pg_cron
-- runs invoke_notify(): when pushes are due it calls the `notify` edge function
-- through pg_net. The function claims the due pushes (claim_push_notifications),
-- sends them with the Expo Push API and reports each outcome
-- (finish_push_notification). Emails stay pending until Resend is set up.
--
-- invoke_notify() reads two Vault secrets, `project_url` and `notify_secret`
-- (the same value as the function's NOTIFY_SECRET). Without them it does
-- nothing, so nothing is sent until the project is set up.

do $$
begin
  -- Supabase has pg_net; plain test databases may not (they stub `net`).
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end;
$$;

alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check check (kind in (
  'booking_confirmed', 'request_received', 'request_declined', 'request_expired', 'booking_cancelled',
  'request_expiring'
));

-- "Request expiring in 2 h" for the camping's team (once per request). Requests
-- answered within 3 hours of arriving skip it: the request push is still fresh.
create function public.queue_expiring_requests()
returns integer
language sql
set search_path = ''
as $$
  with queued as (
    insert into public.notification_queue (kind, booking_id, audience, channel)
    select 'request_expiring', b.id, 'partner', 'push'
    from public.bookings b
    where b.status = 'requested'
      and b.request_expires_at > now()
      and b.request_expires_at <= now() + interval '2 hours'
      and b.created_at < b.request_expires_at - interval '3 hours'
      and not exists (
        select 1 from public.notification_queue q
        where q.booking_id = b.id and q.kind = 'request_expiring'
      )
    returning 1
  )
  select count(*)::integer from queued;
$$;

-- Takes up to p_limit due pushes for one delivery run, with what the message
-- needs and who receives it: the guest's devices in the booking's language, or
-- the devices of the camping's team, each in the member's language.
-- Claiming counts an attempt and moves next_attempt_at on (5, 10, 15… minutes),
-- so a run that dies is retried later. Pushes queued more than 2 hours ago are
-- skipped instead: news that late helps nobody.
create function public.claim_push_notifications(p_limit integer default 50)
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
      'guest_name', b.guest_name, 'camping_name', cp.name, 'request_expires_at', b.request_expires_at
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

-- The outcome of a claimed push: 'sent', 'skipped' (no device, no longer
-- relevant), or anything else to retry. The fifth failed attempt is final.
create function public.finish_push_notification(p_id bigint, p_outcome text, p_error text default null)
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
  where q.id = p_id and q.channel = 'push' and q.status = 'pending';
$$;

-- Devices Expo reports as no longer registered (app removed, token renewed).
create function public.forget_push_tokens(p_tokens text[])
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.push_tokens t where t.token = any (p_tokens) returning 1
  )
  select count(*)::integer from gone;
$$;

-- Calls the notify edge function when pushes are due (pg_net; the request is
-- sent after the transaction commits). Returns the pg_net request id, or null.
create function public.invoke_notify()
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
    where q.status = 'pending' and q.channel = 'push' and q.next_attempt_at <= now()
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

revoke all on function public.queue_expiring_requests() from public, anon, authenticated;
revoke all on function public.claim_push_notifications(integer) from public, anon, authenticated;
revoke all on function public.finish_push_notification(bigint, text, text) from public, anon, authenticated;
revoke all on function public.forget_push_tokens(text[]) from public, anon, authenticated;
revoke all on function public.invoke_notify() from public, anon, authenticated;
grant execute on function public.claim_push_notifications(integer) to service_role;
grant execute on function public.finish_push_notification(bigint, text, text) to service_role;
grant execute on function public.forget_push_tokens(text[]) to service_role;

select cron.schedule('queue-expiring-requests', '*/5 * * * *', 'select public.queue_expiring_requests()');
select cron.schedule('deliver-push', '* * * * *', 'select public.invoke_notify()');
