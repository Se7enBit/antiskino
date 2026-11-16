import { slugSchema, slugify } from '../slug';

describe('slugify', () => {
  it.each([
    ['Camping Thalassa', 'camping-thalassa'],
    ['Κάμπινγκ Θάλασσα', 'kampingk-thalassa'],
    ['Ακτή Ουρανούπολης', 'akti-ouranoupolis'],
    ['  Camping   "Psili Ammos"!  ', 'camping-psili-ammos'],
    ['Χαλκιδική — Σιθωνία 2', 'chalkidiki-sithonia-2'],
    ['Ψαθούρα', 'psathoura'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it('caps the length at 60 without a trailing dash', () => {
    const slug = slugify('a'.repeat(59) + ' bcd');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty slug when nothing usable is left (the form then asks for one)', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugSchema.safeParse('').success).toBe(false);
  });
});
