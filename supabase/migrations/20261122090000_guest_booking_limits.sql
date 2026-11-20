-- M7: limits against fake bookings. Booking needs no account and costs nothing
-- when paying at reception, so one person could fill a camping's allotment.
-- One guest email may hold, among its active bookings (held, requested,
-- confirmed, checked in) that haven't ended:
-- * at most 3 at the same camping with overlapping stays (a family or group
--   booking a few pitches still fits);
-- * at most 10 in total.
-- Over a limit, the booking is refused with SQLSTATE ANT05 (create-booking
-- answers reason 'too_many'). The check runs inside reserve_and_create_booking's
-- transaction, so a refused booking takes no nights.

create function public.check_guest_booking_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_same_stay integer;
  v_upcoming integer;
begin
  -- Two bookings with the same email at once are counted one after the other.
  perform pg_advisory_xact_lock(hashtextextended('guest-booking-limit:' || lower(new.guest_email::text), 0));
  select
    count(*) filter (
      where b.camping_id = new.camping_id
        and daterange(b.arrival, b.departure) && daterange(new.arrival, new.departure)
    ),
    count(*)
  into v_same_stay, v_upcoming
  from public.bookings b
  -- lower() on both sides: with search_path = '' citext's case-insensitive
  -- operators aren't found, and = would compare case-sensitively.
  where lower(b.guest_email::text) = lower(new.guest_email::text)
    and b.status in ('held', 'requested', 'confirmed', 'checked_in')
    and b.departure > (now() at time zone 'Europe/Athens')::date;
  if v_same_stay >= 3 or v_upcoming >= 10 then
    raise exception using
      errcode = 'ANT05',
      message = 'too many active bookings for this email';
  end if;
  return new;
end;
$$;

revoke all on function public.check_guest_booking_limits() from public, anon, authenticated;

create trigger bookings_guest_limits
  before insert on public.bookings
  for each row execute function public.check_guest_booking_limits();

-- The count above looks bookings up by email.
create index bookings_guest_email_lower_idx on public.bookings (lower(guest_email::text));
