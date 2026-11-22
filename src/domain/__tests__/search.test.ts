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
    region: 'halkidiki',
  };

  it('round-trips a request', () => {
    expect(paramsFromRequest(request)).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: '2',
      children: '4,11',
      equipment: 'caravan',
      region: 'halkidiki',
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
    const request = toRequest({ ...query, childAges: [3], region: 'pelion' });
    expect(request).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: 2,
      childAges: [3],
      equipment: 'tent',
      region: 'pelion',
    });
    expect(queryFromRequest(request!)).toEqual({ ...query, childAges: [3], region: 'pelion' });
    expect(toRequest(query)).not.toHaveProperty('region');
  });

  it('lists the distinct known regions, in list order', () => {
    expect(
      regionsOf([
        { region: 'halkidiki' },
        { region: null },
        { region: 'pelion' },
        { region: 'halkidiki' },
        { region: 'Atlantis' },
      ]),
    ).toEqual(['pelion', 'halkidiki']);
  });

  it('drops an unknown region from a link instead of refusing it', () => {
    const params = {
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: '2',
      equipment: 'tent',
    };
    expect(requestFromParams({ ...params, region: 'Halkidiki' })).toEqual(
      requestFromParams(params),
    );
    expect(requestFromParams({ ...params, region: 'halkidiki' })).toMatchObject({
      region: 'halkidiki',
    });
  });
});
