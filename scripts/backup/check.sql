-- What a restore must bring back, one line each, sorted, compared before and
-- after a restore by the Backup restore test (scripts/backup/restore.sh):
-- the number of rows in every table of the app (public) and in auth.users
-- (counts only, never the rows), the scheduled jobs, and the triggers and
-- policies the migrations add outside the public schema.
select format('select %L || '' '' || count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
order by n.nspname, c.relname
\gexec
select 'cron job ' || jobname || ' ' || schedule from cron.job order by jobname;
select 'trigger ' || n.nspname || '.' || c.relname || ' ' || t.tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname in ('auth', 'storage') and p.pronamespace = 'public'::regnamespace
order by 1;
select 'policy ' || schemaname || '.' || tablename || ' ' || policyname
from pg_policies where schemaname = 'storage' order by 1;
select 'realtime ' || schemaname || '.' || tablename
from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
