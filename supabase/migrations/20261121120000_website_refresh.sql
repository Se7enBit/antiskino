-- M7: rebuild the website when the campings it pre-renders change.
--
-- The static site has one page per live camping (name, short description and
-- cover photo in its <head>); a camping that goes live has no page until the
-- site is rebuilt. Changes that matter mark website_refresh; every 5 minutes,
-- once things have been quiet for 2 minutes, send_website_refresh() asks GitHub
-- to run the Website workflow (POST .../actions/workflows/website.yml/dispatches).
-- It needs two Vault secrets: github_repo ('owner/name') and github_token (a
-- fine-grained token for that repository with "Actions: read and write").
-- Without them nothing is sent.

create table public.website_refresh (
  id smallint primary key default 1 check (id = 1),
  -- the last change that needs a rebuild
  requested_at timestamptz,
  -- the last request to GitHub, and its pg_net id (net._http_response keeps the answer for a while)
  sent_at timestamptz,
  request_id bigint
);

comment on table public.website_refresh is 'Singleton (id = 1). Written by triggers and pg_cron only.';

insert into public.website_refresh (id) values (1);

alter table public.website_refresh enable row level security;
revoke all on table public.website_refresh from anon, authenticated;
grant select on table public.website_refresh to service_role;

-- Marks a rebuild when a camping's pre-rendered page appears, disappears or changes.
create function public.mark_website_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'campings' then
    if not (
      (tg_op = 'INSERT' and new.status = 'live')
      or (tg_op = 'DELETE' and old.status = 'live')
      or (tg_op = 'UPDATE' and (
        (old.status = 'live') <> (new.status = 'live')
        or (new.status = 'live'
            and (old.slug, old.name, old.short_descr) is distinct from (new.slug, new.name, new.short_descr))
      ))
    ) then
      return null;
    end if;
  elsif not exists (
    -- camping_photos: the cover photo of a live camping may have changed
    select 1 from public.campings c
    where c.id = coalesce(new.camping_id, old.camping_id) and c.status = 'live'
  ) then
    return null;
  end if;
  update public.website_refresh set requested_at = now() where id = 1;
  return null;
end;
$$;

create trigger campings_mark_website_refresh
  after insert or update or delete on public.campings
  for each row execute function public.mark_website_refresh();

create trigger camping_photos_mark_website_refresh
  after insert or update or delete on public.camping_photos
  for each row execute function public.mark_website_refresh();

-- Asks GitHub for a rebuild when one is due. Returns the pg_net request id, or null.
create function public.send_website_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repo text;
  v_token text;
  v_id bigint;
begin
  if not exists (
    select 1 from public.website_refresh w
    where w.id = 1 and w.requested_at > coalesce(w.sent_at, '-infinity')
      and w.requested_at < now() - interval '2 minutes'
  ) then
    return null;
  end if;
  select s.decrypted_secret into v_repo from vault.decrypted_secrets s where s.name = 'github_repo';
  select s.decrypted_secret into v_token from vault.decrypted_secrets s where s.name = 'github_token';
  if v_repo is null or v_token is null or v_repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' then
    return null;
  end if;
  v_id := net.http_post(
    url := 'https://api.github.com/repos/' || v_repo || '/actions/workflows/website.yml/dispatches',
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || v_token,
      'Content-Type', 'application/json',
      'User-Agent', 'antiskino-database',
      'X-GitHub-Api-Version', '2022-11-28'
    ),
    timeout_milliseconds := 10000
  );
  update public.website_refresh set sent_at = now(), request_id = v_id where id = 1;
  return v_id;
end;
$$;

revoke all on function public.mark_website_refresh() from public, anon, authenticated;
revoke all on function public.send_website_refresh() from public, anon, authenticated;

select cron.schedule('refresh-website', '*/5 * * * *', 'select public.send_website_refresh()');
