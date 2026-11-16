import { centsSchema, formatMoney, isCents } from '../money';

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
