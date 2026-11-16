import { bpsToPercentInput, commissionPercentSchema, formatBps } from '../commission';

describe('commissionPercentSchema', () => {
  it.each([
    ['6', 600],
    ['5.5', 550],
    ['5,5', 550],
    ['5.25', 525],
    [' 0 ', 0],
    ['100', 10000],
    ['0.01', 1],
  ])('%s%% is %i basis points', (input, bps) => {
    expect(commissionPercentSchema.parse(input)).toBe(bps);
  });

  it('treats an empty field as "no override"', () => {
    expect(commissionPercentSchema.parse('')).toBeNull();
    expect(commissionPercentSchema.parse('   ')).toBeNull();
  });

  it.each(['100.01', '101', '-1', '5.255', 'six', '5%', '1e2'])('rejects %s', (input) => {
    expect(commissionPercentSchema.safeParse(input).success).toBe(false);
  });
});

describe('formatBps', () => {
  it('formats basis points per language', () => {
    expect(formatBps(600, 'el')).toBe('6%');
    expect(formatBps(550, 'el')).toBe('5,5%');
    expect(formatBps(525, 'en')).toBe('5.25%');
    expect(formatBps(5, 'en')).toBe('0.05%');
    expect(formatBps(10000, 'en')).toBe('100%');
  });

  it('round-trips through the form field', () => {
    for (const bps of [0, 1, 50, 525, 600, 10000]) {
      expect(commissionPercentSchema.parse(bpsToPercentInput(bps, 'el'))).toBe(bps);
    }
    expect(bpsToPercentInput(null, 'en')).toBe('');
  });
});
