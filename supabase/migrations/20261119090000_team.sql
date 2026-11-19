-- M6: the partner Team screen (SPEC F11 Team: owners; admins on the partner page).
--
-- Profiles and auth.users are private to each user, so the team list comes
-- from partner_team(), which only owners and admins may call. Owners can
-- change roles, remove members and revoke pending invites; a partner always
-- keeps at least one owner (error ANT04).

create function public.partner_team(p_partner_id uuid)
returns table (user_id uuid, role public.partner_role, full_name text, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_partner_owner(p_partner_id)) then
    raise exception 'only the partner''s owners and admins see the team' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, p.full_name, u.email::text, m.created_at
    from public.partner_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.partner_id = p_partner_id
    order by m.created_at, m.user_id;
end;
$$;

-- Internal: raises unless the caller may manage the partner's team, and locks
-- its members so two owners can't remove each other at the same time.
create function public.lock_partner_team(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_partner_owner(p_partner_id)) then
    raise exception 'only the partner''s owners and admins manage the team' using errcode = '42501';
  end if;
  perform 1 from public.partner_members m where m.partner_id = p_partner_id for update;
end;
$$;

create function public.set_partner_member_role(p_partner_id uuid, p_user_id uuid, p_role public.partner_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.partner_role;
begin
  perform public.lock_partner_team(p_partner_id);
  select m.role into v_current from public.partner_members m
  where m.partner_id = p_partner_id and m.user_id = p_user_id;
  if v_current is null then
    raise exception 'not a member of this partner' using errcode = 'P0002';
  end if;
  if p_role is null then
    raise exception 'role is required' using errcode = '22023';
  end if;
  if v_current = 'owner' and p_role <> 'owner' and (
    select count(*) from public.partner_members m where m.partner_id = p_partner_id and m.role = 'owner'
  ) = 1 then
    raise exception 'a partner needs at least one owner' using errcode = 'ANT04';
  end if;
  update public.partner_members m set role = p_role
  where m.partner_id = p_partner_id and m.user_id = p_user_id;
end;
$$;

create function public.remove_partner_member(p_partner_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.partner_role;
begin
  perform public.lock_partner_team(p_partner_id);
  select m.role into v_current from public.partner_members m
  where m.partner_id = p_partner_id and m.user_id = p_user_id;
  if v_current is null then
    raise exception 'not a member of this partner' using errcode = 'P0002';
  end if;
  if v_current = 'owner' and (
    select count(*) from public.partner_members m where m.partner_id = p_partner_id and m.role = 'owner'
  ) = 1 then
    raise exception 'a partner needs at least one owner' using errcode = 'ANT04';
  end if;
  delete from public.partner_members m where m.partner_id = p_partner_id and m.user_id = p_user_id;
end;
$$;

-- Deletes a pending invite, so its link stops working.
create function public.revoke_partner_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner_id uuid;
begin
  select i.partner_id into v_partner_id from public.partner_invites i
  where i.id = p_invite_id and i.accepted_at is null;
  if v_partner_id is null then
    raise exception 'no pending invite' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or public.is_partner_owner(v_partner_id)) then
    raise exception 'only the partner''s owners and admins revoke invites' using errcode = '42501';
  end if;
  delete from public.partner_invites i where i.id = p_invite_id;
end;
$$;

revoke all on function public.partner_team(uuid) from public, anon;
revoke all on function public.lock_partner_team(uuid) from public, anon, authenticated;
revoke all on function public.set_partner_member_role(uuid, uuid, public.partner_role) from public, anon;
revoke all on function public.remove_partner_member(uuid, uuid) from public, anon;
revoke all on function public.revoke_partner_invite(uuid) from public, anon;
grant execute on function public.partner_team(uuid) to authenticated, service_role;
grant execute on function public.set_partner_member_role(uuid, uuid, public.partner_role) to authenticated, service_role;
grant execute on function public.remove_partner_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_partner_invite(uuid) to authenticated, service_role;
