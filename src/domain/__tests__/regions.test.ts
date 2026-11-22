import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isRegion, REGION_KEYS, REGIONS, regionName, sortRegions } from '../regions';

const MIGRATIONS = join(__dirname, '../../../supabase/migrations');

/** The keys allowed by the newest migration that sets campings_region_known. */
function databaseKeys(): string[] {
  const latest = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS, file), 'utf8'))
    .filter((sql) => sql.includes('add constraint campings_region_known'))
    .at(-1);
  const check = /add constraint campings_region_known check \(region in \(([^)]*)\)\)/.exec(
    latest ?? '',
  );
  return [...(check?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

describe('regions', () => {
  it('has the same keys as the database constraint', () => {
    expect(databaseKeys()).toEqual(REGION_KEYS);
  });

  it('has a name in both languages for every region', () => {
    for (const key of REGION_KEYS) {
      expect(REGIONS[key].el).not.toBe('');
      expect(REGIONS[key].en).not.toBe('');
    }
  });

  it('shows names in the language, and an unknown value as it is', () => {
    expect(regionName('halkidiki', 'el')).toBe('Χαλκιδική');
    expect(regionName('halkidiki', 'en')).toBe('Halkidiki');
    expect(regionName('Atlantis', 'el')).toBe('Atlantis');
    expect(isRegion('Halkidiki')).toBe(false);
    expect(isRegion('toString')).toBe(false);
  });

  it('sorts by the name in each language', () => {
    expect(sortRegions(['halkidiki', 'crete', 'attica'], 'en')).toEqual([
      'attica',
      'crete',
      'halkidiki',
    ]);
    expect(sortRegions(['halkidiki', 'crete', 'attica'], 'el')).toEqual([
      'attica',
      'crete',
      'halkidiki',
    ]);
    expect(sortRegions(['pelion', 'epirus'], 'el')).toEqual(['epirus', 'pelion']);
  });
});
