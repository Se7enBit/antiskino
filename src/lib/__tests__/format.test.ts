import { formatShortDate } from '../format';

describe('formatShortDate', () => {
  it('shows the Athens calendar date in each language', () => {
    // 22:30 UTC is already the next day in Athens.
    expect(formatShortDate('2026-11-23T22:30:00Z', 'en')).toBe('24 Nov 2026');
    expect(formatShortDate('2026-11-23T22:30:00Z', 'el')).toMatch(/^24 Νοε/);
  });
});
