-- One booking attempt for the last pitch; waits at the gate first.
\set VERBOSITY verbose
select pg_advisory_lock_shared(424242) as gate \gset
select ref from public.reserve_and_create_booking(
  'cc000000-0000-4000-8000-0000000000f1', '2031-07-01', '2031-07-03', 'tent',
  '{"cc000000-0000-4000-8000-0000000000a0": 2}', '{}',
  '{"name": "Test", "email": "test@example.com", "phone": "+30 690 000 0000", "country": "GR", "locale": "en"}',
  null, 5000, '{}', public.sha256_hex(:'token')
);
