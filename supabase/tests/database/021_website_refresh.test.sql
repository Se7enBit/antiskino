-- Website refresh: marked when pre-rendered camping pages change, sent to GitHub after a quiet spell.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

create function pg_temp.reset() returns void language sql as $$
  update public.website_refresh set requested_at = null, sent_at = null, request_id = null;
$$;
create function pg_temp.marked() returns boolean language sql as $$
  select requested_at is not null from public.website_refresh;
$$;

select results_eq(
  $$ select schedule::text, command::text from cron.job where jobname = 'refresh-website' $$,
  $$ values ('*/5 * * * *', 'select public.send_website_refresh()') $$,
  'a due refresh is sent within 5 minutes'
);

insert into public.partners (id, name) values ('aaaaaaaa-0000-4000-8000-000000000000', 'Partner A');
select pg_temp.reset();

-- What marks a refresh -------------------------------------------------------------

insert into public.campings (id, partner_id, slug, status, name)
values ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000000', 'a1', 'draft', 'A1');
insert into public.camping_photos (camping_id, storage_path)
values ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-0000000000a1/one.jpg');
update public.campings set name = 'A1 Beach' where slug = 'a1';
select is(pg_temp.marked(), false, 'draft campings have no page: no refresh');

update public.campings set status = 'live' where slug = 'a1';
select is(pg_temp.marked(), true, 'a camping going live needs a refresh');

select pg_temp.reset();
update public.campings set phone = '+30 2310 000000' where slug = 'a1';
select is(pg_temp.marked(), false, '...not a change its page doesn''t show');
update public.campings set short_descr = '{"en": "By the sea"}' where slug = 'a1';
select is(pg_temp.marked(), true, '...but a change of its description does');

select pg_temp.reset();
update public.camping_photos set sort = 1 where camping_id = 'a0000000-0000-4000-8000-0000000000a1';
select is(pg_temp.marked(), true, 'its photos may change the cover');

select pg_temp.reset();
update public.campings set status = 'paused' where slug = 'a1';
select is(pg_temp.marked(), true, 'a camping leaving the site needs a refresh');

-- Sending ---------------------------------------------------------------------------

select pg_temp.reset();
update public.website_refresh set requested_at = now();
select is(public.send_website_refresh(), null, 'waits until changes have been quiet for 2 minutes');
update public.website_refresh set requested_at = now() - interval '3 minutes';
select is(public.send_website_refresh(), null, 'without the Vault secrets nothing is sent');

select vault.create_secret('owner/repo/../../user', 'github_repo');
select vault.create_secret('github_pat_test', 'github_token');
select is(public.send_website_refresh(), null, 'a malformed repository name is not used');
delete from vault.secrets where name = 'github_repo';
select vault.create_secret('Owner/repo', 'github_repo');
select isnt(public.send_website_refresh(), null, 'with the secrets, GitHub is asked for a rebuild');
select results_eq(
  $$ select url, convert_from(body, 'utf8')::jsonb, headers ->> 'Authorization'
     from net.http_request_queue order by id desc limit 1 $$,
  $$ values ('https://api.github.com/repos/Owner/repo/actions/workflows/website.yml/dispatches',
             '{"ref": "main"}'::jsonb, 'Bearer github_pat_test') $$,
  '...to run the Website workflow on main'
);
select is(
  (select sent_at from public.website_refresh), now(), 'the request is recorded'
);
select is(public.send_website_refresh(), null, '...and not sent twice');

-- Privileges ------------------------------------------------------------------------

select pg_temp.login('a1111111-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.website_refresh $$, '42501', null, 'users cannot read it');
select throws_ok($$ select public.send_website_refresh() $$, '42501', null, '...nor send a refresh');
reset role;

select * from finish();
rollback;
