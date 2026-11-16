-- M2: copy-link partner invites.
--
-- create_partner_invite() returns a one-time token that the app turns into a
-- link (/invite?t=<token>) for the admin or owner to share; only its SHA-256
-- is stored. accept_partner_invite() adds the signed-in user to the partner's
-- team when their email matches the invite. Emailing invites (Resend) comes
-- later in an edge function; these functions stay the source of truth.

create extension if not exists pgcrypto with schema extensions;

create function public.invite_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

revoke all on function public.invite_token_hash(text) from public, anon, authenticated;

-- Admins invite owners or staff to any partner; owners invite to their own.
-- Replaces any pending invite for the same email. Valid for 7 days.
create function public.create_partner_invite(
  p_partner_id uuid,
  p_email text,
  p_role public.partner_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  if not (public.is_admin() or public.is_partner_owner(p_partner_id)) then
    raise exception 'only admins and the partner''s owners can invite' using errcode = '42501';
  end if;
  if not exists (select 1 from public.partners p where p.id = p_partner_id) then
    raise exception 'partner % not found', p_partner_id using errcode = 'P0002';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid email address' using errcode = '22023';
  end if;
  if p_role is null then
    raise exception 'role is required' using errcode = '22023';
  end if;

  delete from public.partner_invites i
  where i.partner_id = p_partner_id and i.email = v_email and i.accepted_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.partner_invites (partner_id, email, role, token_hash, expires_at)
  values (p_partner_id, v_email, p_role, public.invite_token_hash(v_token), now() + interval '7 days');
  return v_token;
end;
$$;

-- Accepts an invite for the signed-in user. Returns {"status": ...}:
-- accepted (+ partner_id) | invalid | used | expired | wrong_email.
-- An existing owner stays owner when accepting a staff invite.
create function public.accept_partner_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invite public.partner_invites;
begin
  if v_user_id is null then
    raise exception 'sign in to accept an invite' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_invite
  from public.partner_invites i
  where i.token_hash = public.invite_token_hash(p_token)
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_invite.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select lower(u.email) into v_user_email from auth.users u where u.id = v_user_id;
  if v_user_email is null or v_user_email <> lower(v_invite.email::text) then
    return jsonb_build_object('status', 'wrong_email');
  end if;

  insert into public.partner_members as m (partner_id, user_id, role)
  values (v_invite.partner_id, v_user_id, v_invite.role)
  on conflict (partner_id, user_id) do update
    set role = case when m.role = 'owner' then 'owner'::public.partner_role else excluded.role end;

  update public.partner_invites i set accepted_at = now() where i.id = v_invite.id;

  return jsonb_build_object('status', 'accepted', 'partner_id', v_invite.partner_id);
end;
$$;

revoke all on function public.create_partner_invite(uuid, text, public.partner_role) from public, anon;
revoke all on function public.accept_partner_invite(text) from public, anon;
grant execute on function public.create_partner_invite(uuid, text, public.partner_role) to authenticated, service_role;
grant execute on function public.accept_partner_invite(text) to authenticated, service_role;
