import {
  allotmentFormSchema,
  cellFor,
  closingFormSchema,
  indexInventory,
  inventoryKey,
  availabilityErrors,
  nightWindow,
} from '../availability';

const night = (patch = {}) => ({
  pitch_type_id: 'pt1',
  night: '2027-07-01',
  allotment: 5,
  booked: 2,
  closed: false,
  ...patch,
});

describe('nightWindow', () => {
  it('lists consecutive nights across a month end', () => {
    expect(nightWindow('2027-06-29', 4)).toEqual([
      '2027-06-29',
      '2027-06-30',
      '2027-07-01',
      '2027-07-02',
    ]);
    expect(nightWindow('2027-07-01')).toHaveLength(14);
  });
});

describe('cellFor', () => {
  it('tells apart no inventory, open, full and closed nights', () => {
    expect(cellFor(undefined)).toEqual({ kind: 'none' });
    expect(cellFor(night())).toEqual({ kind: 'open', booked: 2, allotment: 5 });
    expect(cellFor(night({ booked: 5 }))).toMatchObject({ kind: 'full' });
    expect(cellFor(night({ allotment: 0, booked: 0 }))).toMatchObject({ kind: 'full' });
    expect(cellFor(night({ booked: 5, closed: true }))).toMatchObject({ kind: 'closed' });
  });

  it('finds rows by pitch type and night', () => {
    const index = indexInventory([night(), night({ night: '2027-07-02', booked: 1 })]);
    expect(index.get(inventoryKey('pt1', '2027-07-02'))?.booked).toBe(1);
    expect(index.get(inventoryKey('pt2', '2027-07-02'))).toBeUndefined();
  });
});

describe('allotmentFormSchema', () => {
  const form = {
    pitchTypeId: 'pt1',
    firstNight: '1/7/2027',
    lastNight: '31/08/2027',
    allotment: '12',
  };

  it('maps the form to set_allotment() arguments', () => {
    expect(allotmentFormSchema.parse(form)).toEqual({
      p_pitch_type_id: 'pt1',
      p_first_night: '2027-07-01',
      p_last_night: '2027-08-31',
      p_allotment: 12,
    });
  });

  it('allows a single night and zero pitches', () => {
    expect(
      allotmentFormSchema.parse({ ...form, lastNight: '01/07/2027', allotment: '0' }),
    ).toMatchObject({
      p_last_night: '2027-07-01',
      p_allotment: 0,
    });
  });

  it.each([
    ['no pitch type', { pitchTypeId: '' }],
    ['a last night before the first', { lastNight: '30/06/2027' }],
    ['a negative allotment', { allotment: '-1' }],
    ['more than 1000 pitches', { allotment: '1001' }],
  ])('rejects %s', (_, patch) => {
    const result = allotmentFormSchema.safeParse({ ...form, ...patch });
    expect(result.success).toBe(false);
    expect(result.error && availabilityErrors(result.error).has('tooLong')).toBe(false);
  });

  it('allows 400 nights and flags 401 as too long', () => {
    // 2027-01-01 + 399 days = 2028-02-04 (2028 is a leap year)
    expect(
      allotmentFormSchema.safeParse({ ...form, firstNight: '01/01/2027', lastNight: '04/02/2028' })
        .success,
    ).toBe(true);
    const result = allotmentFormSchema.safeParse({
      ...form,
      firstNight: '01/01/2027',
      lastNight: '05/02/2028',
    });
    expect(result.error && [...availabilityErrors(result.error)]).toEqual(['tooLong']);
  });
});

describe('availabilityErrors', () => {
  it('maps fields to message keys', () => {
    const result = allotmentFormSchema.safeParse({
      pitchTypeId: '',
      firstNight: '32/01/2027',
      lastNight: 'soon',
      allotment: 'x',
    });
    expect(result.error && [...availabilityErrors(result.error)].sort()).toEqual([
      'allotment',
      'firstNight',
      'lastNight',
      'pitchType',
    ]);
  });
});

describe('closingFormSchema', () => {
  it('needs at least one pitch type', () => {
    const form = {
      pitchTypeIds: ['pt1', 'pt2'],
      firstNight: '15/08/2027',
      lastNight: '15/08/2027',
    };
    expect(closingFormSchema.parse(form)).toEqual({
      ...form,
      firstNight: '2027-08-15',
      lastNight: '2027-08-15',
    });
    expect(closingFormSchema.safeParse({ ...form, pitchTypeIds: [] }).success).toBe(false);
  });
});
