import { directionsUrl, pitchFromCents, shortTime } from '../camping';

describe('pitchFromCents', () => {
  const seasons = [
    { id: 'past', dates: '[2027-05-01,2027-06-01)' },
    { id: 'low', dates: '[2027-06-01,2027-07-01)' },
    { id: 'high', dates: '[2027-07-01,2027-09-01)' },
  ];
  const prices = [
    { season_id: 'past', item_id: 'tent', amount_cents: 800 },
    { season_id: 'low', item_id: 'tent', amount_cents: 1200 },
    { season_id: 'high', item_id: 'tent', amount_cents: 1800 },
    { season_id: 'low', item_id: 'van', amount_cents: 2000 },
  ];

  it('takes the lowest price of the seasons not yet over', () => {
    expect(pitchFromCents('tent', seasons, prices, '2027-05-15')).toBe(800);
    expect(pitchFromCents('tent', seasons, prices, '2027-06-01')).toBe(1200);
    // the last night of the low season is 06-30
    expect(pitchFromCents('tent', seasons, prices, '2027-06-30')).toBe(1200);
    expect(pitchFromCents('tent', seasons, prices, '2027-07-01')).toBe(1800);
    expect(pitchFromCents('van', seasons, prices, '2027-07-01')).toBeNull();
    expect(pitchFromCents('tent', seasons, prices, '2027-09-01')).toBeNull();
  });
});

describe('directionsUrl', () => {
  it('opens Apple Maps on iOS and Google Maps elsewhere', () => {
    expect(directionsUrl(40.1, 23.5, 'ios')).toBe('https://maps.apple.com/?daddr=40.1,23.5');
    expect(directionsUrl(40.1, 23.5, 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=40.1,23.5',
    );
  });
});

describe('shortTime', () => {
  it('drops the seconds', () => {
    expect(shortTime('14:00:00')).toBe('14:00');
    expect(shortTime(null)).toBeNull();
  });
});
