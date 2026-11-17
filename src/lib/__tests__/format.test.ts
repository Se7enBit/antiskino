import { formatNight, formatShortDate } from '../format';

describe('formatShortDate', () => {
  it('shows the Athens calendar date in each language', () => {
    // 22:30 UTC is already the next day in Athens.
    expect(formatShortDate('2026-11-23T22:30:00Z', 'en')).toBe('24 Nov 2026');
    expect(formatShortDate('2026-11-23T22:30:00Z', 'el')).toMatch(/^24 Νοε/);
  });
});

describe('formatNight', () => {
  it('gives the weekday and day/month of a night', () => {
    expect(formatNight('2027-07-01', 'en')).toEqual({ weekday: 'Thu', day: '01/07' });
    expect(formatNight('2027-07-01', 'el')).toEqual({ weekday: 'Πέμ', day: '01/07' });
  });
});
