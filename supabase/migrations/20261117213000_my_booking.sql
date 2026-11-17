-- M4: a signed-in guest's booking, shown like the manage link shows it.
--
-- booking_view() builds the JSON the guest sees; guest_booking() (manage link)
-- and my_booking() (My bookings) both return it, so the two views never drift.

create function public.booking_view(p_booking_id uuid)
returns jsonb
language sql
stable
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
  where b.id = p_booking_id;
$$;

-- Same result as before, now from booking_view().
create or replace function public.guest_booking(p_ref text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.booking_view(b.id)
  from public.bookings b
  where b.ref = upper(btrim(p_ref))
    and b.manage_token_hash = public.sha256_hex(p_token);
$$;

-- The signed-in user's booking by reference (with its id, for cancel_my_booking()),
-- or null when it isn't theirs.
create function public.my_booking(p_ref text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.booking_view(b.id) || jsonb_build_object('id', b.id)
  from public.bookings b
  where b.ref = upper(btrim(p_ref))
    and b.user_id = auth.uid()
    and auth.uid() is not null;
$$;

revoke all on function public.booking_view(uuid) from public, anon, authenticated;
revoke all on function public.my_booking(text) from public, anon;
grant execute on function public.my_booking(text) to authenticated, service_role;
