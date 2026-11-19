-- M6 team management: the team list, roles, removal, revoking invites, the last owner.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Start from no partners or campings: seed.sql data would skew the results.
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

-- Partner A: owner O, staff S. Partner B: owner OB. An admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('a1111111-0000-4000-8000-000000000001', 'owner@test.local', now()),
  ('a1111111-0000-4000-8000-000000000002', 'staff@test.local', now()),
  ('b2222222-0000-4000-8000-000000000001', 'other@test.local', now()),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local', now());
update public.profiles set full_name = 'Olga Owner' where id = 'a1111111-0000-4000-8000-000000000001';
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';
insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role, created_at) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner', now() - interval '2 days'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff', now() - interval '1 day'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner', now());
insert into public.partner_invites (id, partner_id, email, role, token_hash, expires_at, accepted_at) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'new@test.local', 'staff', repeat('1', 64), now() + interval '7 days', null),
  ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000000', 'staff@test.local', 'staff', repeat('2', 64), now(), now());

-- The team list -----------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select results_eq(
  $$ select user_id::text, role::text, full_name, email from public.partner_team('aaaaaaaa-0000-4000-8000-000000000000') $$,
  $$ values
       ('a1111111-0000-4000-8000-000000000001', 'owner', 'Olga Owner', 'owner@test.local'),
       ('a1111111-0000-4000-8000-000000000002', 'staff', null, 'staff@test.local') $$,
  'an owner sees the team with names and emails'
);
select throws_ok(
  $$ select * from public.partner_team('bbbbbbbb-0000-4000-8000-000000000000') $$,
  '42501', null, '...not another partner''s'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select * from public.partner_team('aaaaaaaa-0000-4000-8000-000000000000') $$,
  '42501', null, 'staff do not manage the team'
);
select throws_ok(
  $$ select public.remove_partner_member('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001') $$,
  '42501', null, '...nor remove anyone'
);
reset role;

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select is(
  (select count(*)::integer from public.partner_team('bbbbbbbb-0000-4000-8000-000000000000')), 1,
  'admins see any team'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ select * from public.partner_team('aaaaaaaa-0000-4000-8000-000000000000') $$,
  '42501', null, 'anon cannot call partner_team()'
);
reset role;

-- Roles and removal ----------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_partner_member_role('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'staff') $$,
  'ANT04', null, 'the last owner cannot become staff'
);
select throws_ok(
  $$ select public.remove_partner_member('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001') $$,
  'ANT04', null, '...nor be removed'
);
select lives_ok(
  $$ select public.set_partner_member_role('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'owner') $$,
  'an owner makes staff an owner'
);
select lives_ok(
  $$ select public.set_partner_member_role('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'staff') $$,
  '...and, with another owner, can step down'
);
reset role;

select results_eq(
  $$ select user_id::text, role::text from public.partner_members
     where partner_id = 'aaaaaaaa-0000-4000-8000-000000000000' order by created_at $$,
  $$ values ('a1111111-0000-4000-8000-000000000001', 'staff'), ('a1111111-0000-4000-8000-000000000002', 'owner') $$,
  'the roles changed'
);

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.remove_partner_member('aaaaaaaa-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001') $$,
  'P0002', null, 'only members of the partner can be removed'
);
select lives_ok(
  $$ select public.remove_partner_member('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001') $$,
  'an owner removes a member'
);
reset role;
select is_empty(
  $$ select 1 from public.partner_members where user_id = 'a1111111-0000-4000-8000-000000000001' $$,
  '...who is no longer on the team'
);

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.set_partner_member_role('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff') $$,
  '42501', null, 'another partner''s owner changes nothing'
);
select throws_ok(
  $$ select public.revoke_partner_invite('11111111-0000-4000-8000-000000000001') $$,
  '42501', null, '...nor revokes its invites'
);
reset role;

-- Invites ---------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.revoke_partner_invite('11111111-0000-4000-8000-000000000002') $$,
  'P0002', null, 'an accepted invite cannot be revoked'
);
select public.revoke_partner_invite('11111111-0000-4000-8000-000000000001');
reset role;
select is_empty(
  $$ select 1 from public.partner_invites where id = '11111111-0000-4000-8000-000000000001' $$,
  'an owner revokes a pending invite'
);

select * from finish();
rollback;
