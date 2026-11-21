import { isLanguage, languageOfPath, otherLanguage, pickLanguage } from '../languages';

describe('languages', () => {
  it('picks the first supported device language', () => {
    expect(pickLanguage(['el'])).toBe('el');
    expect(pickLanguage(['el-GR'])).toBe('el');
    expect(pickLanguage(['de', 'el'])).toBe('el');
    expect(pickLanguage(['en_GB', 'el'])).toBe('en');
    expect(pickLanguage(['EL'])).toBe('el');
  });

  it('falls back to English', () => {
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage(['de', null, undefined])).toBe('en');
  });

  it('guards and swaps languages', () => {
    expect(isLanguage('el')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(otherLanguage('el')).toBe('en');
    expect(otherLanguage('en')).toBe('el');
  });
});

describe('languageOfPath', () => {
  it('takes the language from camping page addresses only', () => {
    expect(languageOfPath('/c/thalassa')).toBe('el');
    expect(languageOfPath('/en/c/thalassa')).toBe('en');
    expect(languageOfPath('/en/c/thalassa/')).toBe('en');
    expect(languageOfPath('/')).toBeNull();
    expect(languageOfPath('/search')).toBeNull();
    expect(languageOfPath('/en')).toBeNull();
    expect(languageOfPath('/partner/bookings')).toBeNull();
  });
});
