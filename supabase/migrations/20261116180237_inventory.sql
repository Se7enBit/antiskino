-- M2: online allotment per pitch type and night (SPEC §4.1).
--
-- Rows change only through set_allotment() and set_closed() (and from M4
-- through reserve_and_create_booking() / transition_booking()). API roles get
-- no write privileges on the table at all.

create table public.inventory_nights (
  pitch_type_id uuid not null references public.pitch_types (id) on delete cascade,
  night date not null,
  -- how many pitches Antiskino may sell this night
  allotment integer not null check (allotment >= 0),
  booked integer not null default 0 check (booked >= 0),
  -- stop-sell
  closed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (pitch_type_id, night),
  -- last line of defence against overselling
  constraint inventory_nights_booked_within_allotment check (booked <= allotment)
);

create trigger inventory_nights_set_updated_at
  before update on public.inventory_nights
  for each row execute function public.set_updated_at();

-- Checks the night range shared by set_allotment() and set_closed().
create function public.check_night_range(p_first_night date, p_last_night date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_first_night is null or p_last_night is null or p_last_night < p_first_night then
    raise exception 'the first night must be on or before the last night' using errcode = '22023';
  end if;
  if p_last_night - p_first_night >= 400 then
    raise exception 'at most 400 nights at a time' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.check_night_range(date, date) from public, anon, authenticated;

-- Sets the allotment of a pitch type for every night from p_first_night to
-- p_last_night (both included), creating missing nights. Owners and admins
-- only. Fails without changing anything if a night already has more bookings
-- than the new allotment. Returns the number of nights set.
create function public.set_allotment(
  p_pitch_type_id uuid,
  p_first_night date,
  p_last_night date,
  p_allotment integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camping_id uuid;
  v_conflict record;
  v_count integer;
begin
  perform public.check_night_range(p_first_night, p_last_night);
  if p_allotment is null or p_allotment < 0 or p_allotment > 1000 then
    raise exception 'allotment must be between 0 and 1000' using errcode = '22023';
  end if;

  select pt.camping_id into v_camping_id from public.pitch_types pt where pt.id = p_pitch_type_id;
  if v_camping_id is null then
    raise exception 'pitch type % not found', p_pitch_type_id using errcode = 'P0002';
  end if;
  if not (public.is_admin() or public.is_partner_owner(public.camping_partner(v_camping_id))) then
    raise exception 'only the camping''s owners can set the allotment' using errcode = '42501';
  end if;

  -- Lock the existing nights so a concurrent booking cannot slip in between
  -- the check and the update.
  perform 1 from public.inventory_nights n
  where n.pitch_type_id = p_pitch_type_id and n.night between p_first_night and p_last_night
  for update;

  select n.night, n.booked into v_conflict
  from public.inventory_nights n
  where n.pitch_type_id = p_pitch_type_id
    and n.night between p_first_night and p_last_night
    and n.booked > p_allotment
  order by n.night
  limit 1;
  if found then
    raise exception 'the allotment for % cannot go below its % booked pitches', v_conflict.night, v_conflict.booked
      using errcode = '23514';
  end if;

  insert into public.inventory_nights (pitch_type_id, night, allotment)
  select p_pitch_type_id, p_first_night + i, p_allotment
  from generate_series(0, p_last_night - p_first_night) as i
  on conflict (pitch_type_id, night) do update set allotment = excluded.allotment;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Closes (stop-sell) or reopens the existing nights of a pitch type from
-- p_first_night to p_last_night (both included). Owners, staff and admins.
-- Returns the number of nights changed; nights without inventory are skipped.
create function public.set_closed(
  p_pitch_type_id uuid,
  p_first_night date,
  p_last_night date,
  p_closed boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camping_id uuid;
  v_count integer;
begin
  perform public.check_night_range(p_first_night, p_last_night);
  if p_closed is null then
    raise exception 'closed must be true or false' using errcode = '22023';
  end if;

  select pt.camping_id into v_camping_id from public.pitch_types pt where pt.id = p_pitch_type_id;
  if v_camping_id is null then
    raise exception 'pitch type % not found', p_pitch_type_id using errcode = 'P0002';
  end if;
  if not (public.is_admin() or public.is_partner_member(public.camping_partner(v_camping_id))) then
    raise exception 'only the camping''s team can open or close nights' using errcode = '42501';
  end if;

  update public.inventory_nights n
  set closed = p_closed
  where n.pitch_type_id = p_pitch_type_id
    and n.night between p_first_night and p_last_night
    and n.closed is distinct from p_closed;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_allotment(uuid, date, date, integer) from public, anon;
revoke all on function public.set_closed(uuid, date, date, boolean) from public, anon;
grant execute on function public.set_allotment(uuid, date, date, integer) to authenticated, service_role;
grant execute on function public.set_closed(uuid, date, date, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security and grants: read-only for the camping's team and admins
-- ---------------------------------------------------------------------------

alter table public.inventory_nights enable row level security;

revoke all on table public.inventory_nights from anon, authenticated;
grant select on table public.inventory_nights to authenticated;
grant select, insert, update, delete on table public.inventory_nights to service_role;

create policy inventory_nights_select_member_or_admin
  on public.inventory_nights for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.pitch_types pt
      where pt.id = pitch_type_id and public.is_partner_member(public.camping_partner(pt.camping_id))
    )
  );
