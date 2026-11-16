-- M2: partner companies, their members and pending invites, plus the
-- is_partner_member() / is_partner_owner() helpers used by RLS policies.
-- Writes to members and invites go through edge functions (service role);
-- admins create partners through the API.

create extension if not exists citext with schema extensions;

create type public.partner_status as enum ('active', 'suspended');
create type public.partner_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  legal_name text check (char_length(legal_name) <= 200),
  vat_number text check (char_length(vat_number) <= 40),
  billing_email extensions.citext,
  -- null = platform_settings.default_commission_bps
  commission_bps integer check (commission_bps between 0 and 10000),
  payout_account_ref text,
  status public.partner_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

create table public.partner_members (
  partner_id uuid not null references public.partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.partner_role not null,
  -- per-event email mutes, e.g. {"request_received": false}
  email_prefs jsonb not null default '{}' check (jsonb_typeof(email_prefs) = 'object'),
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);

create index partner_members_user_id_idx on public.partner_members (user_id);

create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  email extensions.citext not null,
  role public.partner_role not null,
  -- SHA-256 of the 32-byte token sent by email; the token itself is never stored
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index partner_invites_partner_id_idx on public.partner_invites (partner_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: they read partner_members without recursing
-- into its own RLS)
-- ---------------------------------------------------------------------------

create function public.is_partner_member(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partner_members m
    where m.partner_id = p_partner_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_partner_owner(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partner_members m
    where m.partner_id = p_partner_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

comment on function public.is_partner_member(uuid) is 'True when the signed-in user is an owner or staff member of the partner.';
comment on function public.is_partner_owner(uuid) is 'True when the signed-in user is an owner of the partner.';

revoke all on function public.is_partner_member(uuid) from public;
revoke all on function public.is_partner_owner(uuid) from public;
grant execute on function public.is_partner_member(uuid) to anon, authenticated, service_role;
grant execute on function public.is_partner_owner(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.partners enable row level security;
alter table public.partner_members enable row level security;
alter table public.partner_invites enable row level security;

revoke all on table public.partners from anon, authenticated;
revoke all on table public.partner_members from anon, authenticated;
revoke all on table public.partner_invites from anon, authenticated;

grant select, insert, update on table public.partners to authenticated;
grant select on table public.partner_members to authenticated;
-- token_hash stays server-side
grant select (id, partner_id, email, role, expires_at, accepted_at, created_at)
  on table public.partner_invites to authenticated;

grant select, insert, update, delete on table public.partners to service_role;
grant select, insert, update, delete on table public.partner_members to service_role;
grant select, insert, update, delete on table public.partner_invites to service_role;

create policy partners_select_member_or_admin
  on public.partners for select
  to authenticated
  using ((select public.is_admin()) or public.is_partner_member(id));

create policy partners_insert_admin
  on public.partners for insert
  to authenticated
  with check ((select public.is_admin()));

create policy partners_update_admin
  on public.partners for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy partner_members_select_member_or_admin
  on public.partner_members for select
  to authenticated
  using ((select public.is_admin()) or public.is_partner_member(partner_id));

create policy partner_invites_select_owner_or_admin
  on public.partner_invites for select
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(partner_id));
