import {
  extraFormSchema,
  feeFormSchema,
  guestCategoryFormSchema,
  parseNightRange,
  priceKey,
  pricesFromForm,
  seasonFormSchema,
  seasonToForm,
  toNightRange,
} from '../rates';

describe('night ranges', () => {
  it('stores the last night as an exclusive upper bound', () => {
    expect(toNightRange('2027-07-01', '2027-08-31')).toBe('[2027-07-01,2027-09-01)');
    expect(parseNightRange('[2027-07-01,2027-09-01)')).toEqual({
      firstNight: '2027-07-01',
      lastNight: '2027-08-31',
    });
    expect(parseNightRange('(2027-07-01,2027-09-01]')).toBeNull();
  });
});

describe('seasonFormSchema', () => {
  const season = {
    nameEl: 'Υψηλή',
    nameEn: '',
    firstNight: '1/7/2027',
    lastNight: '31/08/2027',
    minNights: '3',
  };

  it('maps the form to a seasons row', () => {
    expect(seasonFormSchema.parse(season)).toEqual({
      name: { el: 'Υψηλή' },
      dates: '[2027-07-01,2027-09-01)',
      min_nights: 3,
    });
  });

  it('round-trips through the form', () => {
    const row = { ...seasonFormSchema.parse(season), name: { el: 'Υψηλή' } };
    expect(seasonToForm(row)).toEqual({ ...season, firstNight: '01/07/2027' });
  });

  it('allows a single-night season', () => {
    expect(seasonFormSchema.parse({ ...season, lastNight: '01/07/2027' }).dates).toBe(
      '[2027-07-01,2027-07-02)',
    );
  });

  it.each([
    ['no name', { nameEl: '' }],
    ['a last night before the first', { lastNight: '30/06/2027' }],
    ['an impossible date', { firstNight: '31/06/2027' }],
    ['min nights above 30', { minNights: '31' }],
  ])('rejects %s', (_, patch) => {
    expect(seasonFormSchema.safeParse({ ...season, ...patch }).success).toBe(false);
  });
});

describe('guestCategoryFormSchema', () => {
  it('accepts an open-ended age range', () => {
    expect(
      guestCategoryFormSchema.parse({
        nameEl: 'Ενήλικας',
        nameEn: 'Adult',
        minAge: '12',
        maxAge: '',
      }),
    ).toEqual({
      name: { el: 'Ενήλικας', en: 'Adult' },
      min_age: 12,
      max_age: null,
    });
  });

  it('rejects a maximum below the minimum', () => {
    expect(
      guestCategoryFormSchema.safeParse({ nameEl: 'x', nameEn: '', minAge: '12', maxAge: '4' })
        .success,
    ).toBe(false);
  });
});

describe('extras and fees', () => {
  it('maps an extra', () => {
    expect(
      extraFormSchema.parse({
        nameEl: '',
        nameEn: 'Car',
        unit: 'per_night',
        maxQty: '2',
        active: false,
      }),
    ).toEqual({ name: { en: 'Car' }, unit: 'per_night', max_qty: 2, active: false });
    expect(
      extraFormSchema.safeParse({
        nameEl: 'x',
        nameEn: '',
        unit: 'per_night',
        maxQty: '0',
        active: true,
      }).success,
    ).toBe(false);
  });

  it('maps a fee in euros to cents and requires an amount', () => {
    expect(
      feeFormSchema.parse({ nameEl: 'Τέλος', nameEn: '', unit: 'per_stay', amount: '1,50' }),
    ).toEqual({
      name: { el: 'Τέλος' },
      unit: 'per_stay',
      amount_cents: 150,
    });
    expect(
      feeFormSchema.safeParse({ nameEl: 'Τέλος', nameEn: '', unit: 'per_stay', amount: '' })
        .success,
    ).toBe(false);
  });
});

describe('pricesFromForm', () => {
  const pitch = priceKey('pitch', 'a1000000-0000-4000-8000-000000000001');
  const guest = priceKey('guest', 'ca000000-0000-4000-8000-000000000001');
  const extra = priceKey('extra', 'ea000000-0000-4000-8000-000000000001');

  it('turns filled fields into prices and skips empty ones', () => {
    expect(pricesFromForm({ [pitch]: '15', [guest]: '7,50', [extra]: '' })).toEqual({
      ok: true,
      prices: [
        { item_type: 'pitch', item_id: 'a1000000-0000-4000-8000-000000000001', amount_cents: 1500 },
        { item_type: 'guest', item_id: 'ca000000-0000-4000-8000-000000000001', amount_cents: 750 },
      ],
    });
  });

  it('reports every invalid field', () => {
    expect(pricesFromForm({ [pitch]: 'abc', [guest]: '7,50', [extra]: '-1' })).toEqual({
      ok: false,
      invalid: [pitch, extra],
    });
  });
});
