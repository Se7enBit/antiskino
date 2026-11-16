-- Users who signed up before the on_auth_user_created trigger existed (on the
-- dev project, sign-in worked before the first migration arrived) have no
-- profile. Create the missing ones; the trigger covers everyone from now on.
insert into public.profiles (id, locale)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'locale' in ('el', 'en') then u.raw_user_meta_data ->> 'locale'
    else 'el'
  end
from auth.users u
on conflict (id) do nothing;
