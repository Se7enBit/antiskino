-- create_partner_invite() and accept_partner_invite().
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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

-- Fixtures: partners A and B; owner and staff of A; an admin; two people to invite.
insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local'),
  ('e5555555-0000-4000-8000-000000000001', 'Maria@Test.Local'),
  ('e5555555-0000-4000-8000-000000000002', 'someone-else@test.local');
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';

insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff');

create temporary table tokens (name text primary key, token text);
grant select, insert on tokens to authenticated;

-- ---------------------------------------------------------------------------
-- create_partner_invite
-- ---------------------------------------------------------------------------

select is_definer('public', 'create_partner_invite', array['uuid', 'text', 'partner_role'], 'create_partner_invite() is security definer');
select is_definer('public', 'accept_partner_invite', array['text'], 'accept_partner_invite() is security definer');

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
insert into tokens values ('maria-owner-b', public.create_partner_invite('bbbbbbbb-0000-4000-8000-000000000000', ' Maria@test.local ', 'owner'));
select matches((select token from tokens where name = 'maria-owner-b'), '^[0-9a-f]{64}$', 'an admin gets a 64-character hex token');
select throws_ok(
  $$ select public.create_partner_invite('00000000-0000-4000-8000-000000000000', 'x@test.local', 'owner') $$,
  'P0002', null,
  'inviting to an unknown partner is reported'
);
select throws_ok(
  $$ select public.create_partner_invite('bbbbbbbb-0000-4000-8000-000000000000', 'not-an-email', 'owner') $$,
  '22023', null,
  'the email must look like an email'
);
reset role;

select results_eq(
  $$ select email::text, role::text, expires_at > now() + interval '6 days 23 hours' from public.partner_invites
     where partner_id = 'bbbbbbbb-0000-4000-8000-000000000000' $$,
  $$ values ('maria@test.local', 'owner', true) $$,
  'the invite stores the trimmed, lower-cased email and lasts 7 days'
);
select is(
  (select token_hash from public.partner_invites where partner_id = 'bbbbbbbb-0000-4000-8000-000000000000'),
  encode(sha256(convert_to((select token from tokens where name = 'maria-owner-b'), 'UTF8')), 'hex'),
  'only the SHA-256 of the token is stored'
);

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
insert into tokens values ('first', public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'maria@test.local', 'staff'));
insert into tokens values ('staff-for-maria', public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'maria@test.local', 'staff'));
select is(
  (select count(*)::int from public.partner_invites where partner_id = 'aaaaaaaa-0000-4000-8000-000000000000'),
  1,
  'an owner invites to their own partner, and a new invite replaces the pending one'
);
select throws_ok(
  $$ select public.create_partner_invite('bbbbbbbb-0000-4000-8000-000000000000', 'x@test.local', 'staff') $$,
  '42501', null,
  'an owner cannot invite to another partner'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'x@test.local', 'staff') $$,
  '42501', null,
  'staff cannot invite'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'x@test.local', 'staff') $$,
  '42501', null,
  'anon cannot call create_partner_invite()'
);
select throws_ok(
  $$ select public.accept_partner_invite(repeat('a', 64)) $$,
  '42501', null,
  'anon cannot call accept_partner_invite()'
);
reset role;

-- ---------------------------------------------------------------------------
-- accept_partner_invite
-- ---------------------------------------------------------------------------

select pg_temp.login('e5555555-0000-4000-8000-000000000002');
select is(
  public.accept_partner_invite((select token from tokens where name = 'maria-owner-b')),
  '{"status": "wrong_email"}'::jsonb,
  'someone with a different email cannot use the invite'
);
reset role;
select is_empty(
  $$ select 1 from public.partner_members where user_id = 'e5555555-0000-4000-8000-000000000002' $$,
  '...and does not become a member'
);

select pg_temp.login('e5555555-0000-4000-8000-000000000001');
select is(
  public.accept_partner_invite('not-a-token'),
  '{"status": "invalid"}'::jsonb,
  'a malformed token is invalid'
);
select is(
  public.accept_partner_invite(repeat('0', 64)),
  '{"status": "invalid"}'::jsonb,
  'an unknown token is invalid'
);
select is(
  public.accept_partner_invite((select token from tokens where name = 'first')),
  '{"status": "invalid"}'::jsonb,
  'a replaced invite no longer works'
);
select is(
  public.accept_partner_invite((select token from tokens where name = 'maria-owner-b')),
  '{"status": "accepted", "partner_id": "bbbbbbbb-0000-4000-8000-000000000000"}'::jsonb,
  'the invited person accepts (email matched case-insensitively)'
);
select is(
  public.is_partner_owner('bbbbbbbb-0000-4000-8000-000000000000'),
  true,
  '...and is now an owner of the partner'
);
select is(
  public.accept_partner_invite((select token from tokens where name = 'maria-owner-b')),
  '{"status": "used"}'::jsonb,
  'an invite works only once'
);
select is(
  public.accept_partner_invite((select token from tokens where name = 'staff-for-maria')),
  '{"status": "accepted", "partner_id": "aaaaaaaa-0000-4000-8000-000000000000"}'::jsonb,
  'the same person accepts a staff invite to another partner'
);
select is(
  public.is_partner_member('aaaaaaaa-0000-4000-8000-000000000000')
    and not public.is_partner_owner('aaaaaaaa-0000-4000-8000-000000000000'),
  true,
  '...as staff'
);
reset role;

select isnt(
  (select accepted_at from public.partner_invites where partner_id = 'bbbbbbbb-0000-4000-8000-000000000000'),
  null,
  'accepted invites are marked as accepted'
);

-- Role changes through invites never demote an owner.
select pg_temp.login('d4444444-0000-4000-8000-000000000001');
insert into tokens values ('owner-a-as-staff', public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'owner-a@test.local', 'staff'));
insert into tokens values ('staff-a-as-owner', public.create_partner_invite('aaaaaaaa-0000-4000-8000-000000000000', 'staff-a@test.local', 'owner'));
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select is(
  public.accept_partner_invite((select token from tokens where name = 'owner-a-as-staff')) ->> 'status',
  'accepted',
  'an owner can accept a staff invite...'
);
select is(public.is_partner_owner('aaaaaaaa-0000-4000-8000-000000000000'), true, '...and stays owner');
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select is(
  public.accept_partner_invite((select token from tokens where name = 'staff-a-as-owner')) ->> 'status',
  'accepted',
  'a staff member accepts an owner invite...'
);
select is(public.is_partner_owner('aaaaaaaa-0000-4000-8000-000000000000'), true, '...and becomes owner');
reset role;

-- Expiry
select pg_temp.login('d4444444-0000-4000-8000-000000000001');
insert into tokens values ('expiring', public.create_partner_invite('bbbbbbbb-0000-4000-8000-000000000000', 'someone-else@test.local', 'staff'));
reset role;
update public.partner_invites set expires_at = now() - interval '1 minute'
where email = 'someone-else@test.local';

select pg_temp.login('e5555555-0000-4000-8000-000000000002');
select is(
  public.accept_partner_invite((select token from tokens where name = 'expiring')),
  '{"status": "expired"}'::jsonb,
  'an expired invite cannot be accepted'
);
select is(
  public.is_partner_member('bbbbbbbb-0000-4000-8000-000000000000'),
  false,
  '...and adds no membership'
);
reset role;

select pg_temp.login('e5555555-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.invite_token_hash('x') $$,
  '42501', null,
  'the hashing helper is internal'
);
reset role;

select * from finish();
rollback;
