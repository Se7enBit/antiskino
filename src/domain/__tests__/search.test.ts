import {
  DEFAULT_QUERY,
  paramsFromRequest,
  queryFromRequest,
  regionsOf,
  requestFromParams,
  stayProblem,
  toRequest,
} from '../search';

const query = { ...DEFAULT_QUERY, arrival: '2027-07-10', departure: '2027-07-12' };

describe('stayProblem', () => {
  it('needs dates in the future and at most 30 nights', () => {
    expect(stayProblem(DEFAULT_QUERY, '2027-07-01')).toBe('noDates');
    expect(stayProblem(query, '2027-07-01')).toBeNull();
    expect(stayProblem(query, '2027-07-10')).toBeNull();
    expect(stayProblem(query, '2027-07-11')).toBe('past');
    expect(stayProblem({ ...query, departure: '2027-07-10' }, '2027-07-01')).toBe('noDates');
    expect(stayProblem({ ...query, departure: '2027-08-09' }, '2027-07-01')).toBeNull();
    expect(stayProblem({ ...query, departure: '2027-08-10' }, '2027-07-01')).toBe('tooLong');
  });
});

describe('search URL params', () => {
  const request = {
    arrival: '2027-07-10',
    departure: '2027-07-12',
    adults: 2,
    childAges: [4, 11],
    equipment: 'caravan' as const,
    region: 'Χαλκιδική',
  };

  it('round-trips a request', () => {
    expect(paramsFromRequest(request)).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: '2',
      children: '4,11',
      equipment: 'caravan',
      region: 'Χαλκιδική',
    });
    expect(requestFromParams(paramsFromRequest(request))).toEqual(request);
    const plain = { ...request, childAges: [], region: undefined };
    expect(paramsFromRequest(plain)).not.toHaveProperty('children');
    expect(requestFromParams(paramsFromRequest(plain))).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: 2,
      childAges: [],
      equipment: 'caravan',
    });
  });

  it('takes the first of repeated params', () => {
    expect(requestFromParams({ ...paramsFromRequest(request), adults: ['3', '4'] })?.adults).toBe(
      3,
    );
  });

  it.each([
    ['a missing date', { arrival: undefined }],
    ['an impossible date', { arrival: '2027-02-30' }],
    ['no nights', { departure: '2027-07-10' }],
    ['more than 30 nights', { departure: '2027-08-10' }],
    ['no adults', { adults: '0' }],
    ['a child aged 18', { children: '4,18' }],
    ['a bad age list', { children: '4,,7' }],
    ['unknown equipment', { equipment: 'boat' }],
  ])('rejects %s', (_, patch) => {
    expect(requestFromParams({ ...paramsFromRequest(request), ...patch })).toBeNull();
  });
});

describe('form helpers', () => {
  it('builds a request only with dates, and back', () => {
    expect(toRequest(DEFAULT_QUERY)).toBeNull();
    const request = toRequest({ ...query, childAges: [3], region: 'Pelion' });
    expect(request).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: 2,
      childAges: [3],
      equipment: 'tent',
      region: 'Pelion',
    });
    expect(queryFromRequest(request!)).toEqual({ ...query, childAges: [3], region: 'Pelion' });
    expect(toRequest(query)).not.toHaveProperty('region');
  });

  it('lists distinct regions', () => {
    expect(
      regionsOf([
        { region: 'Πήλιο' },
        { region: null },
        { region: 'Χαλκιδική' },
        { region: 'Πήλιο' },
      ]),
    ).toEqual(['Πήλιο', 'Χαλκιδική']);
  });
});
