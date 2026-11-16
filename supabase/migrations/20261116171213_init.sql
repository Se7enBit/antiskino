-- M1 skeleton: user profiles, platform settings and the is_admin() helper.
--
-- Grants are explicit on purpose: Supabase projects differ in what new objects
-- get by default, so every table and function revokes everything from the API
-- roles and then grants only what it needs. RLS decides which rows.

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by a trigger on sign-up
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 200),
  phone text check (char_length(phone) <= 40),
  -- ISO 3166-1 alpha-2, e.g. 'GR'
  country text check (country ~ '^[A-Z]{2}$'),
  locale text not null default 'el' check (locale in ('el', 'en')),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. is_platform_admin is set only from the Supabase dashboard.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when a user signs up. The app passes the UI language as
-- sign-up metadata ({"locale": "el" | "en"}); anything else falls back to 'el'.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'locale' in ('el', 'en') then new.raw_user_meta_data ->> 'locale'
      else 'el'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin(): used by RLS policies across the schema
-- ---------------------------------------------------------------------------

-- security definer so policies on profiles can call it without recursing into
-- profiles' own RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_admin() is 'True when the signed-in user is a platform admin.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- platform_settings: a single row of platform-wide settings
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  -- basis points: 600 = 6 %. Snapshotted on each booking (SPEC §4.4).
  default_commission_bps integer not null check (default_commission_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is 'Singleton (id = 1). Readable and editable by admins only.';

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- Placeholder rate until the commission is decided (SPEC §10); admins can change it.
insert into public.platform_settings (id, default_commission_bps) values (1, 600);

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_settings enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Users may edit only these columns; is_platform_admin stays out of reach.
grant update (full_name, phone, country, locale) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

revoke all on table public.platform_settings from anon, authenticated;
grant select on table public.platform_settings to authenticated;
grant update (default_commission_bps) on table public.platform_settings to authenticated;
grant select, insert, update, delete on table public.platform_settings to service_role;

create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy platform_settings_select_admin
  on public.platform_settings for select
  to authenticated
  using ((select public.is_admin()));

create policy platform_settings_update_admin
  on public.platform_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
