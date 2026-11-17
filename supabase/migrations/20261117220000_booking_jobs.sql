-- M4: scheduled booking jobs (SPEC §4.5), with pg_cron.
--
-- pg_cron runs in UTC; Athens is UTC+2 in winter and UTC+3 in summer.
--  * every 5 minutes: requests (and, from M7, holds) past their deadline expire
--    and give their nights back;
--  * daily at 01:00 UTC (03:00 or 04:00 in Athens): stays whose departure day
--    has passed in Athens are completed.
-- The arrival reminders and review invites of §4.5 come with emails.

create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule() with a job name updates the job if it already exists.
select cron.schedule('expire-overdue-bookings', '*/5 * * * *', 'select public.expire_overdue_bookings()');
select cron.schedule('complete-past-stays', '0 1 * * *', 'select public.complete_past_stays()');
