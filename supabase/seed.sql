-- Local development data, applied by `supabase db reset` / `supabase start`.
-- Not applied to the hosted projects.
--
-- Demo users for signing in with an email code against the local stack
-- (codes land in Mailpit at http://127.0.0.1:54324):
--   admin@antiskino.test  platform admin
--   owner@antiskino.test  future partner owner (partners arrive in M2)
--   guest@antiskino.test  camper
-- The demo partner and camping are added in M2, together with their tables.

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('locale', u.locale), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@antiskino.test', 'el'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'owner@antiskino.test', 'el'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'guest@antiskino.test', 'en')
) as u (id, email, locale);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email like '%@antiskino.test';

-- Profiles were created by the on_auth_user_created trigger.
update public.profiles set full_name = 'Antiskino Admin', is_platform_admin = true
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set full_name = 'Demo Owner', country = 'GR'
where id = 'a0000000-0000-4000-8000-000000000002';

update public.profiles set full_name = 'Demo Guest', country = 'DE'
where id = 'a0000000-0000-4000-8000-000000000003';
