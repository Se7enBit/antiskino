-- Regions come from a fixed list (SPEC F1): campings.region holds a key such as
-- 'halkidiki', and the app shows the name in the reader's language. The keys
-- are the same as in src/domain/regions.ts (a Jest test compares the two lists):
-- a new region needs a migration that replaces this constraint.
--
-- Earlier values were free text. A name in either language (any letter case,
-- with or without accents) becomes its key; anything else becomes null, for
-- the owner to pick again.

update public.campings c
set region = r.key
from (values
  ('attica', 'Αττική', 'Attica'),
  ('peloponnese', 'Πελοπόννησος', 'Peloponnese'),
  ('central-greece', 'Στερεά Ελλάδα', 'Central Greece'),
  ('evia', 'Εύβοια', 'Evia'),
  ('pelion', 'Πήλιο', 'Pelion'),
  ('thessaly', 'Θεσσαλία', 'Thessaly'),
  ('epirus', 'Ήπειρος', 'Epirus'),
  ('pieria', 'Πιερία', 'Pieria'),
  ('halkidiki', 'Χαλκιδική', 'Halkidiki'),
  ('macedonia', 'Μακεδονία', 'Macedonia'),
  ('thrace', 'Θράκη', 'Thrace'),
  ('ionian-islands', 'Ιόνια νησιά', 'Ionian Islands'),
  ('sporades', 'Σποράδες', 'Sporades'),
  ('cyclades', 'Κυκλάδες', 'Cyclades'),
  ('dodecanese', 'Δωδεκάνησα', 'Dodecanese'),
  ('north-aegean', 'Νησιά Βορείου Αιγαίου', 'North Aegean Islands'),
  ('crete', 'Κρήτη', 'Crete')
) as r (key, el, en)
-- Lower case and without Greek accents, so "ΠΗΛΙΟ" matches "Πήλιο".
where translate(lower(btrim(c.region)), 'άέήίόύώϊϋΐΰ', 'αεηιουωιυιυ')
  in (r.key, translate(lower(r.el), 'άέήίόύώϊϋΐΰ', 'αεηιουωιυιυ'), lower(r.en));

alter table public.campings drop constraint campings_region_check;

update public.campings set region = null
where region not in (
  'attica', 'peloponnese', 'central-greece', 'evia', 'pelion', 'thessaly', 'epirus',
  'pieria', 'halkidiki', 'macedonia', 'thrace', 'ionian-islands', 'sporades', 'cyclades',
  'dodecanese', 'north-aegean', 'crete'
);

alter table public.campings add constraint campings_region_known check (region in (
  'attica', 'peloponnese', 'central-greece', 'evia', 'pelion', 'thessaly', 'epirus',
  'pieria', 'halkidiki', 'macedonia', 'thrace', 'ionian-islands', 'sporades', 'cyclades',
  'dodecanese', 'north-aegean', 'crete'
));
