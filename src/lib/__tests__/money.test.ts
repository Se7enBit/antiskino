import { centsSchema, centsToInput, eurosInputSchema, formatMoney, isCents } from '../money';

// Intl separates the amount and the symbol with no-break spaces; compare with plain spaces.
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('formats cents in Greek', () => {
    expect(plain(formatMoney(123456, 'el'))).toBe('1.234,56 €');
    expect(plain(formatMoney(4500, 'el'))).toBe('45,00 €');
    expect(plain(formatMoney(5, 'el'))).toBe('0,05 €');
  });

  it('formats cents in English', () => {
    expect(formatMoney(123456, 'en')).toBe('€1,234.56');
    expect(formatMoney(0, 'en')).toBe('€0.00');
    expect(formatMoney(-2550, 'en')).toBe('-€25.50');
  });

  it('keeps every cent exact', () => {
    expect(formatMoney(1005, 'en')).toBe('€10.05');
    expect(formatMoney(29, 'en')).toBe('€0.29');
    expect(formatMoney(999999999, 'en')).toBe('€9,999,999.99');
  });

  it('rejects amounts that are not integer cents', () => {
    expect(() => formatMoney(12.5, 'en')).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN, 'el')).toThrow(RangeError);
  });
});

describe('cents validation', () => {
  it('accepts only safe integers', () => {
    expect(isCents(100)).toBe(true);
    expect(isCents(-100)).toBe(true);
    expect(isCents(1.5)).toBe(false);
    expect(isCents('100')).toBe(false);
    expect(isCents(2 ** 53)).toBe(false);
    expect(centsSchema.safeParse(100).success).toBe(true);
    expect(centsSchema.safeParse(0.1).success).toBe(false);
  });
});

describe('euro inputs', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12.50', 1250],
    [' 0,05 ', 5],
    ['0', 0],
    ['999999.99', 99999999],
  ])('%s → %i cents', (text, cents) => {
    expect(eurosInputSchema.parse(text)).toBe(cents);
  });

  it('treats an empty field as no amount', () => {
    expect(eurosInputSchema.parse('  ')).toBeNull();
  });

  it.each(['-1', '12,555', '1.234,50', '€12', 'twelve'])('rejects %s', (text) => {
    expect(eurosInputSchema.safeParse(text).success).toBe(false);
  });

  it('shows cents back in the form', () => {
    expect(centsToInput(1250, 'el')).toBe('12,50');
    expect(centsToInput(1205, 'en')).toBe('12.05');
    expect(centsToInput(1200, 'el')).toBe('12');
    expect(centsToInput(null, 'el')).toBe('');
    for (const cents of [0, 5, 1250, 99999999]) {
      expect(eurosInputSchema.parse(centsToInput(cents, 'el'))).toBe(cents);
    }
  });
});
