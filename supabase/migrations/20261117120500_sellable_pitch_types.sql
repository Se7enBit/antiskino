-- M3: which pitch types can be sold for a stay (SPEC §4.1).
--
-- Used by the search and quote edge functions, which then price the results
-- in TypeScript (supabase/functions/_shared/pricing.ts). A pitch type is
-- sellable when:
--   * its camping is live and the pitch type is active;
--   * it accepts the equipment and holds the whole party (infants count);
--   * every night of the stay has inventory that is open with booked < allotment,
--     and is covered by one of the camping's seasons;
--   * the stay is at least the arrival night's season minimum nights;
--   * arrival is after today in Athens, or today before the camping's same-day cutoff.
-- Prices are checked in TypeScript: an item without a price is not sellable.
--
-- Availability is public information (search shows it), so anon may call the
-- wrapper; it returns ids only, never inventory numbers.

create function public.sellable_pitch_types_at(
  p_now timestamptz,
  p_arrival date,
  p_departure date,
  p_equipment public.equipment,
  p_party_size integer,
  p_camping_id uuid default null
)
returns table (camping_id uuid, pitch_type_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nights integer := p_departure - p_arrival;
  v_local timestamp := p_now at time zone 'Europe/Athens';
begin
  if p_arrival is null or p_departure is null or v_nights < 1 or v_nights > 30 then
    raise exception 'a stay is 1 to 30 nights' using errcode = '22023';
  end if;
  if p_equipment is null or p_party_size is null or p_party_size < 1 or p_party_size > 50 then
    raise exception 'equipment and a party of 1 to 50 people are required' using errcode = '22023';
  end if;

  return query
  select c.id, pt.id
  from public.campings c
  join public.pitch_types pt on pt.camping_id = c.id
  -- the season of the arrival night sets the minimum stay
  join public.seasons arrival_season
    on arrival_season.camping_id = c.id and arrival_season.dates @> p_arrival
  where c.status = 'live'
    and (p_camping_id is null or c.id = p_camping_id)
    and (
      p_arrival > v_local::date
      or (p_arrival = v_local::date and v_local::time < c.same_day_cutoff)
    )
    and pt.active
    and p_equipment = any (pt.accepts)
    and pt.max_people >= p_party_size
    and v_nights >= arrival_season.min_nights
    and (
      select count(*)
      from public.inventory_nights n
      where n.pitch_type_id = pt.id
        and n.night >= p_arrival and n.night < p_departure
        and not n.closed
        and n.booked < n.allotment
        and exists (
          select 1 from public.seasons s where s.camping_id = c.id and s.dates @> n.night
        )
    ) = v_nights
  order by c.id, pt.sort, pt.id;
end;
$$;

comment on function public.sellable_pitch_types_at(timestamptz, date, date, public.equipment, integer, uuid) is
  'Pitch types sellable for a stay as of p_now. Tests call this; the app goes through sellable_pitch_types().';

create function public.sellable_pitch_types(
  p_arrival date,
  p_departure date,
  p_equipment public.equipment,
  p_party_size integer,
  p_camping_id uuid default null
)
returns table (camping_id uuid, pitch_type_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.sellable_pitch_types_at(now(), p_arrival, p_departure, p_equipment, p_party_size, p_camping_id);
$$;

revoke all on function public.sellable_pitch_types_at(timestamptz, date, date, public.equipment, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.sellable_pitch_types_at(timestamptz, date, date, public.equipment, integer, uuid)
  to service_role;

revoke all on function public.sellable_pitch_types(date, date, public.equipment, integer, uuid) from public;
grant execute on function public.sellable_pitch_types(date, date, public.equipment, integer, uuid)
  to anon, authenticated, service_role;
