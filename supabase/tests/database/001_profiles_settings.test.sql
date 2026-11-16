-- profiles, platform_settings, is_admin() and their RLS policies.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'platform_settings', 'platform_settings exists');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table in public has RLS enabled'
);

select function_returns('public', 'is_admin', array[]::text[], 'boolean', 'is_admin() returns boolean');
select is_definer('public', 'is_admin', array[]::text[], 'is_admin() is security definer');

select is(
  (select default_commission_bps from public.platform_settings where id = 1),
  600,
  'platform_settings has its singleton row'
);
select is_empty(
  $$ select u.id from auth.users u left join public.profiles p on p.id = u.id where p.id is null $$,
  'every auth user has a profile (seeded and backfilled users included)'
);

-- ---------------------------------------------------------------------------
-- Fixtures: a guest, another user and an admin
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'guest@test.local', '{"locale": "en"}'),
  ('22222222-2222-4222-8222-222222222222', 'other@test.local', '{"locale": "de"}'),
  ('33333333-3333-4333-8333-333333333333', 'admin@test.local', null);

update public.profiles set is_platform_admin = true where id = '33333333-3333-4333-8333-333333333333';

select is(
  (select count(*)::int from public.profiles where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333')),
  3,
  'a profile is created for every new auth user'
);
select is(
  (select locale from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'en',
  'profile locale comes from sign-up metadata'
);
select is(
  (select locale from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'el',
  'an unsupported or missing locale falls back to el'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(public.is_admin(), false, 'is_admin() is false for anon');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.platform_settings', '42501', null, 'anon cannot read platform_settings');
select throws_ok(
  $$ update public.profiles set full_name = 'x' $$, '42501', null, 'anon cannot update profiles'
);

reset role;

-- ---------------------------------------------------------------------------
-- A regular signed-in user
-- ---------------------------------------------------------------------------

-- Back-date the profile so the updated_at trigger is observable below.
alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set updated_at = '2000-01-01' where id = '11111111-1111-4111-8111-111111111111';
alter table public.profiles enable trigger profiles_set_updated_at;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is(public.is_admin(), false, 'is_admin() is false for a regular user');
select results_eq(
  'select id from public.profiles',
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'profiles_select_own_or_admin: a user reads only their own profile'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Maria P.', country = 'GR', locale = 'el'
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'profiles_update_own: a user can update their own profile'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Hacked' where id = '22222222-2222-4222-8222-222222222222' $$,
  'updating another profile runs without error...'
);
select throws_ok(
  $$ update public.profiles set is_platform_admin = true where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'a user cannot make themselves an admin'
);
select throws_ok(
  $$ insert into public.profiles (id) values ('44444444-4444-4444-8444-444444444444') $$,
  '42501', null,
  'a user cannot insert profiles'
);
select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'a user cannot delete profiles'
);
select is_empty(
  'select * from public.platform_settings',
  'platform_settings_select_admin: a regular user reads no platform settings'
);
select lives_ok(
  $$ update public.platform_settings set default_commission_bps = 0 $$,
  'updating platform_settings as a regular user runs without error...'
);

reset role;

select is(
  (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Maria P.',
  '...and the own-profile update was saved'
);
select is(
  (select updated_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  now(),
  'updated_at is set by the trigger on update'
);
select is(
  (select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  null,
  '...but the other profile was not changed'
);
select is(
  (select default_commission_bps from public.platform_settings),
  600,
  '...and platform_settings_update_admin kept the commission unchanged'
);

-- ---------------------------------------------------------------------------
-- A platform admin
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is(public.is_admin(), true, 'is_admin() is true for a platform admin');
select is(
  (select count(*)::int from public.profiles where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333')),
  3,
  'profiles_select_own_or_admin: an admin reads every profile'
);
select is(
  (select default_commission_bps from public.platform_settings),
  600,
  'platform_settings_select_admin: an admin reads platform settings'
);
select lives_ok(
  $$ update public.platform_settings set default_commission_bps = 700 $$,
  'platform_settings_update_admin: an admin can change the default commission'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Not mine' where id = '22222222-2222-4222-8222-222222222222' $$,
  'an admin update of another profile runs without error...'
);

reset role;

select is(
  (select default_commission_bps from public.platform_settings),
  700,
  '...the commission change was saved'
);
select is(
  (select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  null,
  '...but admins edit other profiles only from the dashboard, not through the API'
);

-- ---------------------------------------------------------------------------
-- Constraints and cascades
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.platform_settings (id, default_commission_bps) values (2, 500) $$,
  '23514', null,
  'platform_settings is a singleton'
);
select throws_ok(
  $$ update public.platform_settings set default_commission_bps = 10001 $$,
  '23514', null,
  'commission is at most 100 %'
);
select throws_ok(
  $$ update public.profiles set locale = 'de' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null,
  'profile locale is el or en'
);

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is_empty(
  $$ select 1 from public.profiles where id = '22222222-2222-4222-8222-222222222222' $$,
  'deleting an auth user deletes the profile'
);

select * from finish();
rollback;
