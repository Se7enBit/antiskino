-- A live camping whose only pitch type has 1 pitch on 2031-07-01 and 07-02.
insert into public.partners (id, name) values ('cc000000-0000-4000-8000-000000000000', 'Concurrency test');
insert into public.campings (id, partner_id, slug, status, name)
values ('cc000000-0000-4000-8000-0000000000c1', 'cc000000-0000-4000-8000-000000000000', 'concurrency-test', 'live', 'Concurrency test');
insert into public.pitch_types (id, camping_id, name, accepts, max_people)
values ('cc000000-0000-4000-8000-0000000000f1', 'cc000000-0000-4000-8000-0000000000c1', '{"en": "Tent"}', '{tent}', 4);
insert into public.seasons (camping_id, name, dates)
values ('cc000000-0000-4000-8000-0000000000c1', '{"en": "Summer"}', '[2031-06-01,2031-09-01)');
insert into public.guest_categories (id, camping_id, name, min_age)
values ('cc000000-0000-4000-8000-0000000000a0', 'cc000000-0000-4000-8000-0000000000c1', '{"en": "Adult"}', 12);
insert into public.inventory_nights (pitch_type_id, night, allotment)
values ('cc000000-0000-4000-8000-0000000000f1', '2031-07-01', 1), ('cc000000-0000-4000-8000-0000000000f1', '2031-07-02', 1);
