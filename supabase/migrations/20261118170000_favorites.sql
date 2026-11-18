-- M6: favorites (SPEC F8). Signed-in users keep their saved campings here; the
-- app keeps a guest's on the device and adds them here on sign-in.

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  camping_id uuid not null references public.campings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, camping_id)
);

create index favorites_camping_id_idx on public.favorites (camping_id);

alter table public.favorites enable row level security;
revoke all on table public.favorites from anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;
grant select, insert, update, delete on table public.favorites to service_role;

create policy favorites_select_own
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Only live campings can be saved (a camping that goes back to draft stays saved).
create policy favorites_insert_own_live
  on public.favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.camping_is_live(camping_id));

create policy favorites_delete_own
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- On sign-in the app adds the favorites saved on the device: live campings
-- only, duplicates ignored. Returns how many were added.
create function public.merge_favorites(p_camping_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'sign in to keep favorites' using errcode = '42501';
  end if;
  insert into public.favorites (user_id, camping_id)
  select auth.uid(), c.id
  from public.campings c
  where c.id = any (coalesce(p_camping_ids, '{}')) and c.status = 'live'
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.merge_favorites(uuid[]) from public, anon;
grant execute on function public.merge_favorites(uuid[]) to authenticated, service_role;
