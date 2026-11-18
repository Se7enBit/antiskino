import { timeLeft, todayGroups } from '../today';

const TODAY = '2027-07-10';

const stay = (
  ref: string,
  arrival: string,
  departure: string,
  status: string,
  patch: {
    party_size?: number;
    arrival_eta?: string | null;
    request_expires_at?: string | null;
  } = {},
) => ({
  ref,
  arrival,
  departure,
  status,
  party_size: 2,
  arrival_eta: null,
  request_expires_at: null,
  ...patch,
});

describe('todayGroups', () => {
  const list = [
    stay('ARR-LATE', '2027-07-10', '2027-07-12', 'confirmed', { arrival_eta: '18:00:00' }),
    stay('ARR-EARLY', '2027-07-10', '2027-07-11', 'confirmed', { arrival_eta: '10:00:00' }),
    stay('ARR-NOETA', '2027-07-10', '2027-07-11', 'confirmed'),
    stay('ARR-DONE', '2027-07-10', '2027-07-13', 'checked_in', { party_size: 4 }),
    stay('ARR-NOSHOW', '2027-07-10', '2027-07-13', 'no_show'),
    stay('STILL-EXPECTED', '2027-07-09', '2027-07-12', 'confirmed'),
    stay('STAYING', '2027-07-08', '2027-07-15', 'checked_in', { party_size: 3 }),
    stay('LEAVING', '2027-07-07', '2027-07-10', 'checked_in', { party_size: 5 }),
    stay('GONE-UNSEEN', '2027-07-07', '2027-07-10', 'confirmed'),
    stay('LATER', '2027-07-20', '2027-07-22', 'confirmed'),
    stay('CANCELLED', '2027-07-10', '2027-07-12', 'cancelled'),
    stay('REQ-2', '2027-08-01', '2027-08-03', 'requested', {
      request_expires_at: '2027-07-10T15:00:00Z',
    }),
    stay('REQ-1', '2027-07-20', '2027-07-22', 'requested', {
      request_expires_at: '2027-07-10T09:00:00Z',
    }),
  ];
  const groups = todayGroups(list, TODAY);
  const refs = (items: { ref: string }[]) => items.map((b) => b.ref);

  it('lists late guests first, then today’s arrivals by expected time', () => {
    expect(refs(groups.arrivals)).toEqual([
      'STILL-EXPECTED',
      'ARR-EARLY',
      'ARR-LATE',
      'ARR-NOETA',
      'ARR-DONE',
      'ARR-NOSHOW',
    ]);
  });

  it('lists checked-in guests leaving today', () => {
    expect(refs(groups.departures)).toEqual(['LEAVING']);
  });

  it('counts the checked-in stays of tonight', () => {
    expect(groups.inHouse).toEqual({ stays: 2, people: 7 });
  });

  it('lists requests by deadline', () => {
    expect(refs(groups.requests)).toEqual(['REQ-1', 'REQ-2']);
  });
});

describe('timeLeft', () => {
  const now = new Date('2027-07-10T09:00:00Z');

  it('rounds up to the minute', () => {
    expect(timeLeft('2027-07-10T12:20:30Z', now)).toEqual({ hours: 3, minutes: 21 });
    expect(timeLeft('2027-07-10T09:00:01Z', now)).toEqual({ hours: 0, minutes: 1 });
    expect(timeLeft('2027-07-11T09:00:00Z', now)).toEqual({ hours: 24, minutes: 0 });
  });

  it('is null once the deadline has passed', () => {
    expect(timeLeft('2027-07-10T09:00:00Z', now)).toBeNull();
    expect(timeLeft('2027-07-10T08:00:00Z', now)).toBeNull();
    expect(timeLeft('not a date', now)).toBeNull();
  });
});
