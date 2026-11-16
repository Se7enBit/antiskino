import { localized } from '../localized';

describe('localized', () => {
  const text = { el: 'Κάμπινγκ', en: 'Camping' };

  it('returns the requested language', () => {
    expect(localized(text, 'el')).toBe('Κάμπινγκ');
    expect(localized(text, 'en')).toBe('Camping');
  });

  it('falls back to the other language when missing or blank', () => {
    expect(localized({ el: 'Μόνο ελληνικά' }, 'en')).toBe('Μόνο ελληνικά');
    expect(localized({ en: 'English only' }, 'el')).toBe('English only');
    expect(localized({ el: '  ', en: 'Camping' }, 'el')).toBe('Camping');
  });

  it('returns an empty string for anything that is not localized text', () => {
    for (const value of [null, undefined, 'plain', 42, [], {}, { el: 5 }, { de: 'Hallo' }]) {
      expect(localized(value, 'el')).toBe('');
    }
  });
});
