import { z } from 'zod';

import type { Language } from '@/i18n/languages';

/**
 * The areas a camping can be in (SPEC F1): campings.region holds the key, and
 * every screen shows the name in its language. The database accepts only these
 * keys (constraint campings_region_known); a new area needs a migration that
 * adds its key there too (a test compares the two lists).
 */
export const REGIONS = {
  attica: { el: 'Αττική', en: 'Attica' },
  peloponnese: { el: 'Πελοπόννησος', en: 'Peloponnese' },
  'central-greece': { el: 'Στερεά Ελλάδα', en: 'Central Greece' },
  evia: { el: 'Εύβοια', en: 'Evia' },
  pelion: { el: 'Πήλιο', en: 'Pelion' },
  thessaly: { el: 'Θεσσαλία', en: 'Thessaly' },
  epirus: { el: 'Ήπειρος', en: 'Epirus' },
  pieria: { el: 'Πιερία', en: 'Pieria' },
  halkidiki: { el: 'Χαλκιδική', en: 'Halkidiki' },
  macedonia: { el: 'Μακεδονία', en: 'Macedonia' },
  thrace: { el: 'Θράκη', en: 'Thrace' },
  'ionian-islands': { el: 'Ιόνια νησιά', en: 'Ionian Islands' },
  sporades: { el: 'Σποράδες', en: 'Sporades' },
  cyclades: { el: 'Κυκλάδες', en: 'Cyclades' },
  dodecanese: { el: 'Δωδεκάνησα', en: 'Dodecanese' },
  'north-aegean': { el: 'Νησιά Βορείου Αιγαίου', en: 'North Aegean Islands' },
  crete: { el: 'Κρήτη', en: 'Crete' },
} as const satisfies Record<string, Record<Language, string>>;

export type Region = keyof typeof REGIONS;

export const REGION_KEYS = Object.keys(REGIONS) as Region[];

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && Object.hasOwn(REGIONS, value);
}

/** The region's name in the language; an unknown value is shown as it is. */
export function regionName(region: string, language: Language): string {
  return isRegion(region) ? REGIONS[region][language] : region;
}

/** Regions sorted by their name in the language, for pickers and filters. */
export function sortRegions(regions: readonly Region[], language: Language): Region[] {
  return [...regions].sort((a, b) =>
    REGIONS[a][language].localeCompare(REGIONS[b][language], language),
  );
}

/** A form's region: a key from the list, or '' for none (stored as null). */
export const regionFieldSchema = z
  .string()
  .refine((value) => value === '' || isRegion(value))
  .transform((value) => (isRegion(value) ? value : null));
