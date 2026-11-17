-- The pg_cron jobs of SPEC §4.5 that M4 needs.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_extension('pg_cron', 'pg_cron is enabled');
select results_eq(
  $$ select jobname::text, schedule::text, command::text from cron.job
     where jobname in ('expire-overdue-bookings', 'complete-past-stays') order by jobname $$,
  $$ values
       ('complete-past-stays', '0 1 * * *', 'select public.complete_past_stays()'),
       ('expire-overdue-bookings', '*/5 * * * *', 'select public.expire_overdue_bookings()') $$,
  'requests expire every 5 minutes and stays complete nightly'
);

select * from finish();
rollback;
