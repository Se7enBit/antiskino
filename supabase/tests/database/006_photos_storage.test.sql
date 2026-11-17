-- The photos bucket and its storage.objects policies.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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

-- Fixtures: partner A (owner, staff) with camping a1; partner B (owner) with camping b1; an admin.
insert into auth.users (id, email) values
  ('a1111111-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('a1111111-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('b2222222-0000-4000-8000-000000000001', 'owner-b@test.local'),
  ('d4444444-0000-4000-8000-000000000001', 'admin@test.local');
update public.profiles set is_platform_admin = true where id = 'd4444444-0000-4000-8000-000000000001';

insert into public.partners (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Partner B');
insert into public.partner_members (partner_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a1111111-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b2222222-0000-4000-8000-000000000001', 'owner');
insert into public.campings (id, partner_id, slug, name) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'A1'),
  ('b0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'b1', 'B1');

-- Storage blocks direct SQL deletes unless this is set, as the Storage API
-- does for its own delete queries; set it so the delete policies are tested.
set local storage.allow_delete_query to 'true';

-- ---------------------------------------------------------------------------

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photos' $$,
  $$ values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'the public photos bucket allows JPEG, PNG and WebP up to 5 MB'
);
select is_definer('public', 'can_manage_camping_files', array['text'], 'can_manage_camping_files() is security definer');

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg') $$,
  'photos_insert_owner_or_admin: an owner uploads to their camping''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'b0000000-0000-4000-8000-0000000000b1/x.jpg') $$,
  '42501', null,
  'an owner cannot upload to another partner''s camping'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'not-a-camping/x.jpg') $$,
  '42501', null,
  'files must sit in a camping folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-4000-8000-000000000000/x.jpg') $$,
  '42501', null,
  'an unknown camping folder is refused'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'photos' $$,
  $$ values ('a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg') $$,
  'photos_select_owner_or_admin: an owner sees their camping''s files'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000002');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'a0000000-0000-4000-8000-0000000000a1/staff.jpg') $$,
  '42501', null,
  'staff cannot upload photos'
);
select lives_ok(
  $$ delete from storage.objects where name = 'a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg' $$,
  'a staff delete runs without error...'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name = 'a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg'),
  1,
  '...but photos_delete_owner_or_admin kept the file'
);

select pg_temp.login('b2222222-0000-4000-8000-000000000001');
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'photos' $$,
  'another partner does not see the files through the API'
);
reset role;

select pg_temp.login(null);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'a0000000-0000-4000-8000-0000000000a1/anon.jpg') $$,
  '42501', null,
  'anon cannot upload'
);
reset role;

select pg_temp.login('d4444444-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'b0000000-0000-4000-8000-0000000000b1/admin.jpg') $$,
  'an admin uploads to any camping'
);
reset role;

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select lives_ok(
  $$ delete from storage.objects where name = 'a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg' $$,
  'the owner deletes a photo...'
);
reset role;
select is_empty(
  $$ select 1 from storage.objects where name = 'a0000000-0000-4000-8000-0000000000a1/pitch-1.jpg' $$,
  '...and it is gone'
);

select * from finish();
rollback;
