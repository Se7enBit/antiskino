-- M2: campings and what they sell: photos, pitch types, seasons, guest
-- categories, extras, fees and seasonal prices.
--
-- Reads: anyone sees live campings and their active catalog; partner members
-- see their own campings in any status; admins see everything.
-- Writes: partner owners and admins. Admins create campings and set their
-- status (set_camping_status); owners edit only the profile columns.

create extension if not exists btree_gist with schema extensions;

create type public.camping_status as enum ('draft', 'live', 'paused');
create type public.confirmation_mode as enum ('instant', 'request');
create type public.payment_mode as enum ('on_site', 'deposit', 'full');
create type public.cancellation_policy as enum ('flexible', 'moderate', 'strict');
create type public.equipment as enum ('tent', 'caravan', 'camper');
create type public.unit_category as enum ('pitch');
create type public.extra_unit as enum ('per_night', 'per_stay');
create type public.fee_unit as enum ('per_person_night', 'per_pitch_night', 'per_stay');
create type public.price_item_type as enum ('pitch', 'guest', 'extra');

-- Translatable text is jsonb {"el": "...", "en": "..."}. With p_required, at
-- least one language must be non-blank.
create function public.is_localized_text(p_value jsonb, p_required boolean default false)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
    and not exists (
      select 1 from jsonb_each(p_value) e
      where e.key not in ('el', 'en') or jsonb_typeof(e.value) <> 'string'
    )
    and (not p_required or btrim(coalesce(p_value ->> 'el', '') || coalesce(p_value ->> 'en', '')) <> '');
$$;

revoke all on function public.is_localized_text(jsonb, boolean) from public;
-- Needed by everyone who writes rows checked with it.
grant execute on function public.is_localized_text(jsonb, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- campings
-- ---------------------------------------------------------------------------

create table public.campings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  status public.camping_status not null default 'draft',
  name text not null check (char_length(name) between 1 and 120),
  short_descr jsonb not null default '{}' check (public.is_localized_text(short_descr)),
  descr jsonb not null default '{}' check (public.is_localized_text(descr)),
  house_rules jsonb not null default '{}' check (public.is_localized_text(house_rules)),
  region text check (char_length(region) <= 80),
  address text check (char_length(address) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  phone text check (char_length(phone) <= 40),
  email extensions.citext,
  -- keys from the fixed amenity list in src/domain
  amenities text[] not null default '{}' check (cardinality(amenities) <= 50),
  check_in_from time,
  check_out_until time,
  same_day_cutoff time not null default '14:00',
  confirmation_mode public.confirmation_mode not null default 'instant',
  request_expiry_hours integer not null default 24 check (request_expiry_hours between 2 and 48),
  payment_mode public.payment_mode not null default 'on_site',
  deposit_percent integer check (deposit_percent between 20 and 100),
  cancellation_policy public.cancellation_policy not null default 'flexible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campings_deposit_percent_matches_mode
    check ((payment_mode = 'deposit') = (deposit_percent is not null)),
  -- Online payments arrive in M7 (SPEC F5); drop this constraint then.
  constraint campings_on_site_payment_until_m7 check (payment_mode = 'on_site')
);

create index campings_partner_id_idx on public.campings (partner_id);

create trigger campings_set_updated_at
  before update on public.campings
  for each row execute function public.set_updated_at();

create function public.camping_partner(p_camping_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.partner_id from public.campings c where c.id = p_camping_id;
$$;

create function public.camping_is_live(p_camping_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.campings c where c.id = p_camping_id and c.status = 'live');
$$;

comment on function public.camping_partner(uuid) is 'The partner that owns a camping (null if it does not exist).';
comment on function public.camping_is_live(uuid) is 'True when the camping is published (status live).';

revoke all on function public.camping_partner(uuid) from public;
revoke all on function public.camping_is_live(uuid) from public;
grant execute on function public.camping_partner(uuid) to anon, authenticated, service_role;
grant execute on function public.camping_is_live(uuid) to anon, authenticated, service_role;

-- Publish, pause or return a camping to draft. Admin only (SPEC F12).
create function public.set_camping_status(p_camping_id uuid, p_status public.camping_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only platform admins can change a camping''s status' using errcode = '42501';
  end if;
  update public.campings set status = p_status where id = p_camping_id;
  if not found then
    raise exception 'camping % not found', p_camping_id using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_camping_status(uuid, public.camping_status) from public, anon;
grant execute on function public.set_camping_status(uuid, public.camping_status) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catalog tables
-- ---------------------------------------------------------------------------

create table public.camping_photos (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index camping_photos_camping_id_idx on public.camping_photos (camping_id);

create table public.pitch_types (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  unit_category public.unit_category not null default 'pitch',
  name jsonb not null check (public.is_localized_text(name, true)),
  descr jsonb not null default '{}' check (public.is_localized_text(descr)),
  included jsonb not null default '{}' check (public.is_localized_text(included)),
  accepts public.equipment[] not null check (cardinality(accepts) between 1 and 3),
  -- infants count
  max_people integer not null check (max_people between 1 and 50),
  size_m2 integer check (size_m2 between 1 and 10000),
  photos text[] not null default '{}',
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pitch_types_camping_id_idx on public.pitch_types (camping_id);

create trigger pitch_types_set_updated_at
  before update on public.pitch_types
  for each row execute function public.set_updated_at();

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  name jsonb not null check (public.is_localized_text(name, true)),
  -- nights covered: [first night, last night + 1)
  dates daterange not null check (not isempty(dates) and not lower_inf(dates) and not upper_inf(dates)),
  min_nights integer not null default 1 check (min_nights between 1 and 30),
  constraint seasons_no_overlap exclude using gist (camping_id with =, dates with &&)
);

create table public.guest_categories (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  name jsonb not null check (public.is_localized_text(name, true)),
  min_age integer not null check (min_age between 0 and 120),
  -- null = no upper limit
  max_age integer check (max_age between 0 and 120 and max_age >= min_age),
  sort integer not null default 0,
  constraint guest_categories_no_overlap
    exclude using gist (camping_id with =, int4range(min_age, max_age, '[]') with &&)
);

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  name jsonb not null check (public.is_localized_text(name, true)),
  unit public.extra_unit not null,
  max_qty integer not null default 1 check (max_qty between 1 and 20),
  active boolean not null default true,
  sort integer not null default 0
);

create index extras_camping_id_idx on public.extras (camping_id);

create table public.fees (
  id uuid primary key default gen_random_uuid(),
  camping_id uuid not null references public.campings (id) on delete cascade,
  name jsonb not null check (public.is_localized_text(name, true)),
  unit public.fee_unit not null,
  amount_cents integer not null check (amount_cents >= 0)
);

create index fees_camping_id_idx on public.fees (camping_id);

-- Price of a pitch type, guest category or extra in a season, in cents.
create table public.prices (
  season_id uuid not null references public.seasons (id) on delete cascade,
  item_type public.price_item_type not null,
  item_id uuid not null,
  amount_cents integer not null check (amount_cents >= 0),
  primary key (season_id, item_type, item_id)
);

create index prices_item_idx on public.prices (item_type, item_id);

-- item_id points at one of three tables, so integrity is kept by triggers:
-- the item must belong to the season's camping, and deleting an item deletes
-- its prices.
create function public.check_price_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_season_camping uuid;
  v_item_camping uuid;
begin
  select s.camping_id into v_season_camping from public.seasons s where s.id = new.season_id;
  v_item_camping := case new.item_type
    when 'pitch' then (select p.camping_id from public.pitch_types p where p.id = new.item_id)
    when 'guest' then (select g.camping_id from public.guest_categories g where g.id = new.item_id)
    when 'extra' then (select e.camping_id from public.extras e where e.id = new.item_id)
  end;
  if v_item_camping is null or v_item_camping is distinct from v_season_camping then
    raise exception '% % does not belong to the season''s camping', new.item_type, new.item_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger prices_check_item
  before insert or update on public.prices
  for each row execute function public.check_price_item();

create function public.delete_item_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.prices p
  where p.item_type = tg_argv[0]::public.price_item_type and p.item_id = old.id;
  return old;
end;
$$;

create trigger pitch_types_delete_prices
  after delete on public.pitch_types
  for each row execute function public.delete_item_prices('pitch');
create trigger guest_categories_delete_prices
  after delete on public.guest_categories
  for each row execute function public.delete_item_prices('guest');
create trigger extras_delete_prices
  after delete on public.extras
  for each row execute function public.delete_item_prices('extra');

revoke all on function public.check_price_item() from public, anon, authenticated;
revoke all on function public.delete_item_prices() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.campings enable row level security;
alter table public.camping_photos enable row level security;
alter table public.pitch_types enable row level security;
alter table public.seasons enable row level security;
alter table public.guest_categories enable row level security;
alter table public.extras enable row level security;
alter table public.fees enable row level security;
alter table public.prices enable row level security;

revoke all on table
  public.campings, public.camping_photos, public.pitch_types, public.seasons,
  public.guest_categories, public.extras, public.fees, public.prices
  from anon, authenticated;

grant select on table
  public.campings, public.camping_photos, public.pitch_types, public.seasons,
  public.guest_categories, public.extras, public.fees, public.prices
  to anon, authenticated;

grant select, insert, update, delete on table
  public.campings, public.camping_photos, public.pitch_types, public.seasons,
  public.guest_categories, public.extras, public.fees, public.prices
  to service_role;

-- campings: admins insert; owners update the profile only (not partner, slug or status).
grant insert on table public.campings to authenticated;
grant update (
  name, short_descr, descr, house_rules, region, address, lat, lng, phone, email, amenities,
  check_in_from, check_out_until, same_day_cutoff, confirmation_mode, request_expiry_hours,
  payment_mode, deposit_percent, cancellation_policy
) on table public.campings to authenticated;

-- Catalog rows never move to another camping.
grant insert, delete on table
  public.camping_photos, public.pitch_types, public.seasons, public.guest_categories,
  public.extras, public.fees, public.prices
  to authenticated;
grant update (storage_path, sort) on table public.camping_photos to authenticated;
grant update (unit_category, name, descr, included, accepts, max_people, size_m2, photos, active, sort)
  on table public.pitch_types to authenticated;
grant update (name, dates, min_nights) on table public.seasons to authenticated;
grant update (name, min_age, max_age, sort) on table public.guest_categories to authenticated;
grant update (name, unit, max_qty, active, sort) on table public.extras to authenticated;
grant update (name, unit, amount_cents) on table public.fees to authenticated;
grant update (amount_cents) on table public.prices to authenticated;

-- campings
create policy campings_select_live_member_or_admin
  on public.campings for select
  to anon, authenticated
  using (status = 'live' or (select public.is_admin()) or public.is_partner_member(partner_id));

create policy campings_insert_admin
  on public.campings for insert
  to authenticated
  with check ((select public.is_admin()));

create policy campings_update_owner_or_admin
  on public.campings for update
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(partner_id))
  with check ((select public.is_admin()) or public.is_partner_owner(partner_id));

-- Catalog tables keyed by camping_id share one shape of policies.
create policy camping_photos_select
  on public.camping_photos for select
  to anon, authenticated
  using (
    public.camping_is_live(camping_id)
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy pitch_types_select
  on public.pitch_types for select
  to anon, authenticated
  using (
    (active and public.camping_is_live(camping_id))
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy seasons_select
  on public.seasons for select
  to anon, authenticated
  using (
    public.camping_is_live(camping_id)
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy guest_categories_select
  on public.guest_categories for select
  to anon, authenticated
  using (
    public.camping_is_live(camping_id)
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy extras_select
  on public.extras for select
  to anon, authenticated
  using (
    (active and public.camping_is_live(camping_id))
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy fees_select
  on public.fees for select
  to anon, authenticated
  using (
    public.camping_is_live(camping_id)
    or (select public.is_admin())
    or public.is_partner_member(public.camping_partner(camping_id))
  );

create policy camping_photos_write_owner_or_admin
  on public.camping_photos for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

create policy pitch_types_write_owner_or_admin
  on public.pitch_types for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

create policy seasons_write_owner_or_admin
  on public.seasons for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

create policy guest_categories_write_owner_or_admin
  on public.guest_categories for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

create policy extras_write_owner_or_admin
  on public.extras for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

create policy fees_write_owner_or_admin
  on public.fees for all
  to authenticated
  using ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)))
  with check ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(camping_id)));

-- prices follow their season's camping
create policy prices_select
  on public.prices for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and (
          public.camping_is_live(s.camping_id)
          or (select public.is_admin())
          or public.is_partner_member(public.camping_partner(s.camping_id))
        )
    )
  );

create policy prices_write_owner_or_admin
  on public.prices for all
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(s.camping_id)))
    )
  )
  with check (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and ((select public.is_admin()) or public.is_partner_owner(public.camping_partner(s.camping_id)))
    )
  );
