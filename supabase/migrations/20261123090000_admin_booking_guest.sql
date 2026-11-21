-- Admins correct a guest's contact details on a booking (a typo in the email,
-- a wrong phone): admin_update_booking_guest(). Partners still can't (SPEC F6:
-- they edit only the pitch number and the internal note). The change is logged
-- in booking_events as an event that keeps the status, with no note, so no
-- personal data is copied there. Cancelling stays partner_booking_action(),
-- which already lets admins act (actor 'admin').

create or replace function public.admin_update_booking_guest(
  p_booking_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_locale text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.booking_status;
begin
  if not public.is_admin() then
    raise exception 'only admins can change a guest''s details' using errcode = '42501';
  end if;
  select b.status into v_status from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if p_email is null or btrim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(btrim(p_email)) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  -- The table's checks validate name, phone, country and locale.
  update public.bookings b
  set guest_name = btrim(p_name),
      guest_email = btrim(p_email),
      guest_phone = regexp_replace(btrim(p_phone), '\s+', ' ', 'g'),
      guest_country = upper(btrim(p_country)),
      locale = p_locale
  where b.id = p_booking_id;

  insert into public.booking_events (booking_id, actor_kind, actor_user_id, from_status, to_status)
  values (p_booking_id, 'admin', auth.uid(), v_status, v_status);
end;
$$;

revoke all on function public.admin_update_booking_guest(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_booking_guest(uuid, text, text, text, text, text)
  to authenticated, service_role;
