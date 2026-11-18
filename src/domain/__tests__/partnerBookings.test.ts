import {
  defaultRange,
  filterBookings,
  matchesSearch,
  matchesStatus,
  parseRange,
  receptionActions,
} from '../partnerBookings';

const TODAY = '2027-07-10';

describe('booking list range', () => {
  it('goes 60 days back with no end by default', () => {
    expect(defaultRange(TODAY)).toEqual({ from: '2027-05-11', to: null });
    expect(parseRange('', ' ', TODAY)).toEqual({ range: { from: '2027-05-11', to: null } });
  });

  it('reads Greek-style dates', () => {
    expect(parseRange('1/8/2027', '15.08.2027', TODAY)).toEqual({
      range: { from: '2027-08-01', to: '2027-08-15' },
    });
    expect(parseRange('', '2027-07-31', TODAY)).toEqual({
      range: { from: '2027-05-11', to: '2027-07-31' },
    });
  });

  it('rejects wrong dates and an end before the start', () => {
    expect(parseRange('31/02/2027', '', TODAY)).toEqual({ error: 'from' });
    expect(parseRange('', 'soon', TODAY)).toEqual({ error: 'to' });
    expect(parseRange('10/08/2027', '01/08/2027', TODAY)).toEqual({ error: 'to' });
  });
});

describe('booking filters', () => {
  it('groups cancelled, declined and expired', () => {
    expect(
      ['cancelled', 'declined', 'expired', 'confirmed'].map((s) => matchesStatus(s, 'cancelled')),
    ).toEqual([true, true, true, false]);
    expect(matchesStatus('no_show', 'no_show')).toBe(true);
    expect(matchesStatus('no_show', 'all')).toBe(true);
    expect(matchesStatus('confirmed', 'checked_in')).toBe(false);
  });

  it('finds a name ignoring case and accents, or a reference', () => {
    const booking = { guest_name: 'Μαρία Παπαδοπούλου', ref: 'ANT-7KQ2XM' };
    expect(matchesSearch(booking, 'μαρια')).toBe(true);
    expect(matchesSearch(booking, 'ΠΑΠΑΔΟΠΟΥΛΟΥ')).toBe(true);
    expect(matchesSearch(booking, '7kq2')).toBe(true);
    expect(matchesSearch(booking, '  ')).toBe(true);
    expect(matchesSearch(booking, 'Γιώργος')).toBe(false);
  });

  it('combines status and text', () => {
    const list = [
      { status: 'confirmed', guest_name: 'Anna', ref: 'ANT-AAAAAA' },
      { status: 'requested', guest_name: 'Anna', ref: 'ANT-BBBBBB' },
      { status: 'confirmed', guest_name: 'Nikos', ref: 'ANT-CCCCCC' },
    ];
    expect(filterBookings(list, { status: 'confirmed', text: 'ann' }).map((b) => b.ref)).toEqual([
      'ANT-AAAAAA',
    ]);
    expect(filterBookings(list, { status: 'all', text: '' })).toHaveLength(3);
  });
});

describe('reception actions', () => {
  it('answers requests', () => {
    expect(receptionActions({ status: 'requested', arrival: '2027-07-20' }, TODAY)).toEqual([
      'accept',
      'decline',
    ]);
  });

  it('checks in or marks a no-show from the arrival day', () => {
    expect(receptionActions({ status: 'confirmed', arrival: '2027-07-11' }, TODAY)).toEqual([
      'cancel',
    ]);
    expect(receptionActions({ status: 'confirmed', arrival: TODAY }, TODAY)).toEqual([
      'check_in',
      'no_show',
      'cancel',
    ]);
    expect(receptionActions({ status: 'confirmed', arrival: '2027-07-08' }, TODAY)).toEqual([
      'check_in',
      'no_show',
      'cancel',
    ]);
  });

  it('offers nothing once the stay has started or ended', () => {
    for (const status of [
      'checked_in',
      'completed',
      'no_show',
      'cancelled',
      'declined',
      'expired',
    ]) {
      expect(receptionActions({ status, arrival: TODAY }, TODAY)).toEqual([]);
    }
  });
});
