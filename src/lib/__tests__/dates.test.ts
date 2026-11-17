import {
  addDays,
  addMonths,
  daysBetween,
  formatDateInput,
  isIsoDate,
  isoDateSchema,
  monthGrid,
  monthStart,
  nightsBetween,
  parseDateInput,
  stayNights,
  todayInAthens,
  weekdayIndex,
} from '../dates';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    for (const d of ['2026-07-01', '2028-02-29', '2026-12-31']) expect(isIsoDate(d)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const d of [
      '2026-02-29',
      '2026-13-01',
      '2026-7-1',
      '2026-07-01T00:00',
      '',
      20260701,
      null,
    ]) {
      expect(isIsoDate(d)).toBe(false);
    }
  });

  it('backs the zod schema used at boundaries', () => {
    expect(isoDateSchema.safeParse('2026-07-01').success).toBe(true);
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});

describe('night math', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts nights from arrival (inclusive) to departure (exclusive)', () => {
    expect(nightsBetween('2026-07-01', '2026-07-04')).toBe(3);
    expect(stayNights('2026-07-01', '2026-07-04')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });

  it('is not affected by daylight saving changes', () => {
    // Athens switches to summer time on 2026-03-29 and back on 2026-10-25.
    expect(nightsBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(stayNights('2026-10-24', '2026-10-27')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
  });

  it('returns no nights when departure is not after arrival', () => {
    expect(stayNights('2026-07-04', '2026-07-04')).toEqual([]);
    expect(stayNights('2026-07-04', '2026-07-01')).toEqual([]);
    expect(daysBetween('2026-07-04', '2026-07-01')).toBe(-3);
  });

  it('throws on invalid input instead of guessing', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    expect(() => addDays('2026-07-01', 1.5)).toThrow(RangeError);
    expect(() => nightsBetween('07/01/2026', '2026-07-04')).toThrow(RangeError);
  });
});

describe('todayInAthens', () => {
  it.each([
    ['2026-06-30T20:59:59Z', '2026-06-30'], // 23:59:59 summer time (UTC+3)
    ['2026-06-30T21:00:00Z', '2026-07-01'], // 00:00 summer time
    ['2026-01-15T21:59:59Z', '2026-01-15'], // 23:59:59 winter time (UTC+2)
    ['2026-01-15T22:00:00Z', '2026-01-16'], // 00:00 winter time
    ['2026-03-28T22:30:00Z', '2026-03-29'], // night of the spring DST switch
    ['2026-12-31T22:00:00Z', '2027-01-01'],
  ])('%s is %s in Athens', (instant, expected) => {
    expect(todayInAthens(new Date(instant))).toBe(expected);
  });
});

describe('date inputs', () => {
  it.each([
    ['1/7/2027', '2027-07-01'],
    ['01/07/2027', '2027-07-01'],
    ['31.12.2027', '2027-12-31'],
    [' 2027-07-01 ', '2027-07-01'],
    ['29/02/2028', '2028-02-29'],
  ])('%s → %s', (text, iso) => {
    expect(parseDateInput(text)).toBe(iso);
  });

  it.each(['31/06/2027', '29/02/2027', '7/1', '2027/07/01', 'tomorrow', ''])(
    'rejects %s',
    (text) => {
      expect(parseDateInput(text)).toBeNull();
    },
  );

  it('formats dates the Greek way', () => {
    expect(formatDateInput('2027-07-01')).toBe('01/07/2027');
    expect(parseDateInput(formatDateInput('2027-12-31'))).toBe('2027-12-31');
  });
});

describe('calendar helpers', () => {
  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2027-07-05')).toBe(0); // Monday
    expect(weekdayIndex('2027-07-11')).toBe(6); // Sunday
    expect(weekdayIndex('1999-12-31')).toBe(4); // Friday, before the reference Monday
  });

  it('moves between months across years', () => {
    expect(monthStart('2027-07-14')).toBe('2027-07-01');
    expect(addMonths('2027-12-01', 1)).toBe('2028-01-01');
    expect(addMonths('2027-01-01', -1)).toBe('2026-12-01');
    expect(addMonths('2027-07-01', 0)).toBe('2027-07-01');
  });

  it('lays a month out in Monday-first weeks', () => {
    const weeks = monthGrid('2027-02-01'); // starts on a Monday, 28 days
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toBe('2027-02-01');
    const july = monthGrid('2027-07-01'); // starts on a Thursday, 31 days
    expect(july[0]).toEqual([
      null,
      null,
      null,
      '2027-07-01',
      '2027-07-02',
      '2027-07-03',
      '2027-07-04',
    ]);
    expect(july.at(-1)).toEqual([
      '2027-07-26',
      '2027-07-27',
      '2027-07-28',
      '2027-07-29',
      '2027-07-30',
      '2027-07-31',
      null,
    ]);
    expect(monthGrid('2028-02-10').flat().filter(Boolean)).toHaveLength(29); // leap year
  });
});
