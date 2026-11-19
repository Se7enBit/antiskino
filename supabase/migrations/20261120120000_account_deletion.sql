-- M7: deleting an account (Google Play requires it for apps with sign-in; GDPR).
--
-- The delete-account edge function checks who is asking, calls
-- prepare_account_deletion() and then deletes the login, which removes the
-- profile, favorites, devices and team memberships (foreign keys).
-- Bookings stay for the campings' records and commission, anonymized: the
-- guest's name, email, phone, plate, arrival time, note and stored link go.
-- The user's reviews are removed. The last owner of a partner can't leave.

create function public.prepare_account_deletion(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select lower(u.email) into v_email from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- A partner always keeps an owner: hand the camping over first.
  if exists (
    select 1 from public.partner_members m
    where m.user_id = p_user_id and m.role = 'owner'
      and not exists (
        select 1 from public.partner_members o
        where o.partner_id = m.partner_id and o.role = 'owner' and o.user_id <> p_user_id
      )
  ) then
    return 'last_owner';
  end if;

  update public.notification_queue q
  set status = 'skipped', last_error = 'account deleted'
  from public.bookings b
  where q.booking_id = b.id and q.audience = 'guest' and q.status = 'pending'
    and (b.user_id = p_user_id or lower(b.guest_email::text) = v_email);

  update public.bookings b
  set guest_name = 'Deleted guest',
      guest_email = 'deleted@deleted.invalid',
      guest_phone = '+0 000000',
      vehicle_plate = null,
      arrival_eta = null,
      guest_note = null,
      manage_token_enc = null,
      user_id = null
  where b.user_id = p_user_id or lower(b.guest_email::text) = v_email;

  delete from public.reviews r where r.user_id = p_user_id;
  return 'ok';
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
