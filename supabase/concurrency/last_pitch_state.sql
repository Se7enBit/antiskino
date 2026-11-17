-- "booked/allotment" per night, then the number of bookings: 1/1,1/1|1 when correct.
select (
  select string_agg(n.booked || '/' || n.allotment, ',' order by n.night)
  from public.inventory_nights n where n.pitch_type_id = 'cc000000-0000-4000-8000-0000000000f1'
) || '|' || (
  select count(*) from public.bookings b where b.pitch_type_id = 'cc000000-0000-4000-8000-0000000000f1'
);
