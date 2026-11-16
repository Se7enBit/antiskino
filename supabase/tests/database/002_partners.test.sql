-- partners, partner_members, partner_invites and the partner helpers.
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Switch to a signed-in user (or anon with null) for the rest of the transaction; `reset role` returns to postgres.
-- Start from no partners or campings: seed.sql data would skew the counts.
-- Everything here is rolled back at the end.
delete from public.campings;
delete from public.partners;

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role": "anon"}'
    else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: partners A and B, an owner and a staff member of A, an owner of B,
-- an outsider and an admin
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local'),
  ('c3333333-0000-4000-8000-000000000001', 'outsider@test.local'),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local');
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';

insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');

insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');

insert into public.partner_invites (partner_id, email, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'new-staff@test.local', 'staff', repeat('a', 64), now() + interval '7 days'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'new-owner@test.local', 'owner', repeat('b', 64), now() + interval '7 days');

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

select has_table('public', 'partners', 'partners exists');
select has_table('public', 'partner_members', 'partner_members exists');
select has_table('public', 'partner_invites', 'partner_invites exists');
select is_definer('public', 'is_partner_member', array['uuid'], 'is_partner_member() is security definer');
select is_definer('public', 'is_partner_owner', array['uuid'], 'is_partner_owner() is security definer');

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

select pg_temp.login(null);
select throws_ok('select * from public.partners', '42501', null, 'anon cannot read partners');
select throws_ok('select * from public.partner_members', '42501', null, 'anon cannot read partner_members');
select throws_ok('select id from public.partner_invites', '42501', null, 'anon cannot read partner_invites');
reset role;

-- ---------------------------------------------------------------------------
-- An outsider (signed in, no membership)
-- ---------------------------------------------------------------------------

select pg_temp.login('c3333333-0000-4000-8000-000000000001');
select is_empty('select id from public.partners', 'partners_select_member_or_admin: an outsider reads no partners');
select is_empty('select partner_id from public.partner_members', 'partner_members_select_member_or_admin: an outsider reads no members');
select is_empty('select id from public.partner_invites', 'partner_invites_select_owner_or_admin: an outsider reads no invites');
select is(public.is_partner_member('aaaaaaaa-0000-4000-8000-000000000000'), false, 'is_partner_member() is false for an outsider');
select throws_ok(
  $$ insert into public.partners (name) values ('Sneaky') $$,
  '42501', null,
  'partners_insert_admin: an outsider cannot create a partner'
);
reset role;

-- ---------------------------------------------------------------------------
-- Staff of partner A
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(public.is_partner_member('aaaaaaaa-0000-4000-8000-000000000000'), true, 'is_partner_member() is true for staff');
select is(public.is_partner_owner('aaaaaaaa-0000-4000-8000-000000000000'), false, 'is_partner_owner() is false for staff');
select results_eq(
  'select id from public.partners',
  $$ values ('aaaaaaaa-0000-4000-8000-000000000000'::uuid) $$,
  'staff read only their own partner'
);
select is(
  (select count(*)::int from public.partner_members),
  2,
  'staff read their own team (and no other partner''s)'
);
select is_empty('select id from public.partner_invites', 'staff do not read invites');
reset role;

-- ---------------------------------------------------------------------------
-- Owner of partner A
-- ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is(public.is_partner_owner('aaaaaaaa-0000-4000-8000-000000000000'), true, 'is_partner_owner() is true for the owner');
select is(public.is_partner_owner('bbbbbbbb-0000-4000-8000-000000000000'), false, 'is_partner_owner() is false for another partner');
select results_eq(
  'select id from public.partners',
  $$ values ('aaaaaaaa-0000-4000-8000-000000000000'::uuid) $$,
  'a member of partner A reads no row of partner B (partners)'
);
select results_eq(
  'select email::text from public.partner_invites',
  $$ values ('new-staff@test.local') $$,
  'partner_invites_select_owner_or_admin: the owner reads only their partner''s invites'
);
select throws_ok('select token_hash from public.partner_invites', '42501', null, 'invite token hashes are not readable through the API');
select lives_ok(
  $$ update public.partners set commission_bps = 0 where id = 'aaaaaaaa-0000-4000-8000-000000000000' $$,
  'an owner update of their partner runs without error...'
);
select throws_ok(
  $$ insert into public.partner_members (partner_id, user_id, role)
     values ('aaaaaaaa-0000-4000-8000-000000000000', 'c3333333-0000-4000-8000-000000000001', 'staff') $$,
  '42501', null,
  'members are not added through the API'
);
reset role;

select is(
  (select commission_bps from public.partners where id = 'aaaaaaaa-0000-4000-8000-000000000000'),
  null,
  '...but partners_update_admin kept the commission unchanged'
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is((select count(*)::int from public.partners), 2, 'partners_select_member_or_admin: an admin reads every partner');
select is((select count(*)::int from public.partner_members), 3, 'an admin reads every membership');
select is((select count(*)::int from public.partner_invites), 2, 'an admin reads every invite');
select lives_ok(
  $$ insert into public.partners (name, commission_bps) values ('Partner C', 500) $$,
  'partners_insert_admin: an admin can create a partner'
);
select lives_ok(
  $$ update public.partners set commission_bps = 450 where id = 'bbbbbbbb-0000-4000-8000-000000000000' $$,
  'partners_update_admin: an admin can set a commission override'
);
reset role;

select is(
  (select commission_bps from public.partners where id = 'bbbbbbbb-0000-4000-8000-000000000000'),
  450,
  '...and the override was saved'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.partners set commission_bps = 10001 where id = 'aaaaaaaa-0000-4000-8000-000000000000' $$,
  '23514', null,
  'commission override is at most 100 %'
);
select throws_ok(
  $$ insert into public.partner_invites (partner_id, email, role, token_hash, expires_at)
     values ('aaaaaaaa-0000-4000-8000-000000000000', 'x@test.local', 'staff', 'not-a-hash', now()) $$,
  '23514', null,
  'invites store a SHA-256 hex digest, not a raw token'
);

select * from finish();
rollback;
