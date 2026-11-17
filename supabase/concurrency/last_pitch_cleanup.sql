-- Removes everything last_pitch_setup.sql and the attempts created.
delete from public.bookings where camping_id = 'cc000000-0000-4000-8000-0000000000c1';
delete from public.campings where id = 'cc000000-0000-4000-8000-0000000000c1';
delete from public.partners where id = 'cc000000-0000-4000-8000-000000000000';
