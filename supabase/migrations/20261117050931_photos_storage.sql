-- M2: photos of campings and pitch types in Supabase Storage.
--
-- One public bucket (photos are shown to everyone once a camping is live, and
-- public buckets are served from the CDN). Files live under the camping's id,
-- `<camping_id>/<file>`; only that camping's owners and admins may upload,
-- replace or delete them. camping_photos.storage_path and pitch_types.photos
-- hold these paths.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the object's first path segment is a camping the user may manage.
create function public.can_manage_camping_files(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_admin()
        or public.is_partner_owner(public.camping_partner(split_part(p_object_name, '/', 1)::uuid))
    else false
  end;
$$;

revoke all on function public.can_manage_camping_files(text) from public, anon;
grant execute on function public.can_manage_camping_files(text) to authenticated, service_role;

create policy photos_insert_owner_or_admin
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and public.can_manage_camping_files(name));

-- Needed by remove() and upsert; reading the files themselves goes through the public URL.
create policy photos_select_owner_or_admin
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and public.can_manage_camping_files(name));

create policy photos_update_owner_or_admin
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.can_manage_camping_files(name))
  with check (bucket_id = 'photos' and public.can_manage_camping_files(name));

create policy photos_delete_owner_or_admin
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.can_manage_camping_files(name));
