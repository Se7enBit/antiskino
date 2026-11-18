-- M5: reception (SPEC F11 Today / Bookings, F10 push).
--
-- * partner_booking_action() also checks guests in and marks no-shows, for
--   confirmed bookings from their arrival day (Athens). A no-show keeps its
--   nights: only cancel / decline / expire give nights back (SPEC §4.1).
-- * update_booking_desk() sets the assigned pitch and the internal note, the
--   only booking fields the camping edits (SPEC F6).
-- * Bookings are published to Realtime, so Today and Bookings update live;
--   RLS decides who receives which changes.
-- * push_tokens: the devices of signed-in users, for Expo push.

create or replace function public.partner_booking_action(p_booking_id uuid, p_action text, p_note text)
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
    when 'check_in' then 'checked_in'
    when 'no_show' then 'no_show'
  end;
  if v_to is null then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if p_action in ('accept', 'decline') and v_booking.status <> 'requested' then
    raise exception 'only requests can be accepted or declined' using errcode = 'ANT02';
  end if;
  if p_action in ('check_in', 'no_show') and v_booking.status <> 'confirmed' then
    raise exception 'only confirmed bookings can be checked in or marked as no-show' using errcode = 'ANT02';
  end if;
  if p_action in ('check_in', 'no_show') and public.athens_today() < v_booking.arrival then
    raise exception 'not before the arrival day' using errcode = 'ANT02';
  end if;
  if p_action = 'cancel' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'a reason is required to cancel' using errcode = '22023';
  end if;

  return public.transition_booking(
    p_booking_id, v_to, case when v_member then 'partner' else 'admin' end::public.booking_actor, auth.uid(), p_note
  );
end;
$$;

-- The pitch number reception gives the guest, and a note only the team sees.
-- Empty text clears a field. Errors: 42501 not the camping's team; P0002
-- unknown booking; 23514 too long.
create function public.update_booking_desk(p_booking_id uuid, p_assigned_pitch text, p_internal_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camping_id uuid;
begin
  select b.camping_id into v_camping_id from public.bookings b where b.id = p_booking_id;
  if v_camping_id is null then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not (public.is_partner_member(public.camping_partner(v_camping_id)) or public.is_admin()) then
    raise exception 'only the camping''s team can edit its bookings' using errcode = '42501';
  end if;
  update public.bookings b
  set assigned_pitch = nullif(btrim(p_assigned_pitch), ''),
      internal_note = nullif(btrim(p_internal_note), '')
  where b.id = p_booking_id;
end;
$$;

revoke all on function public.update_booking_desk(uuid, text, text) from public, anon;
grant execute on function public.update_booking_desk(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
     ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push tokens (Expo)
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  -- ExponentPushToken[...]
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from anon, authenticated;
grant select on table public.push_tokens to authenticated;
grant select, insert, update, delete on table public.push_tokens to service_role;

create policy push_tokens_select_own
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Registers this device for the signed-in user. A device that changes hands
-- moves to the new user.
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in to receive notifications' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Stops notifications to this device (e.g. on sign-out).
create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens t where t.token = p_token and t.user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated, service_role;
grant execute on function public.unregister_push_token(text) to authenticated, service_role;
