import {
  EMPTY_GUEST,
  bookingParams,
  bookingTargetFromParams,
  guestFormSchema,
  lineLabel,
  partyByCategory,
} from '../booking';

const PITCH = '0b3f6a3c-5a8e-4c79-9f43-2b7b3a2c1d10';
const STAY = {
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: '2',
  children: '4,11',
  equipment: 'tent',
};

describe('booking URL params', () => {
  it('reads the pitch type and the stay, without a region', () => {
    const target = bookingTargetFromParams({ pitchType: PITCH, ...STAY, region: 'Πήλιο' });
    expect(target).toEqual({
      pitchTypeId: PITCH,
      stay: {
        arrival: '2027-07-10',
        departure: '2027-07-12',
        adults: 2,
        childAges: [4, 11],
        equipment: 'tent',
      },
    });
    expect(bookingParams(target!)).toEqual({ pitchType: PITCH, ...STAY });
  });

  it('needs a pitch type id and a complete stay', () => {
    expect(bookingTargetFromParams({ pitchType: 'tent', ...STAY })).toBeNull();
    expect(bookingTargetFromParams({ pitchType: PITCH, ...STAY, departure: undefined })).toBeNull();
  });
});

describe('guestFormSchema', () => {
  const form = {
    ...EMPTY_GUEST,
    name: ' Maria Papadopoulou ',
    email: ' maria@example.com ',
    phone: ' +30  690 123 4567 ',
    country: 'gr',
  };

  it('tidies the details and drops empty optional fields', () => {
    expect(guestFormSchema.parse(form)).toEqual({
      name: 'Maria Papadopoulou',
      email: 'maria@example.com',
      phone: '+30 690 123 4567',
      country: 'GR',
      locale: 'el',
      vehiclePlate: undefined,
      arrivalEta: undefined,
      note: undefined,
    });
    expect(
      guestFormSchema.parse({ ...form, arrivalEta: '09:30', vehiclePlate: ' ΙΚΑ 1234 ' }),
    ).toMatchObject({
      arrivalEta: '09:30',
      vehiclePlate: 'ΙΚΑ 1234',
    });
  });

  it.each([
    ['no name', { name: ' ' }],
    ['a bad email', { email: 'maria@' }],
    ['a phone without the country code', { phone: '690 123 4567' }],
    ['a country name instead of a code', { country: 'Greece' }],
    ['an impossible time', { arrivalEta: '24:10' }],
  ])('rejects %s', (_, patch) => {
    expect(guestFormSchema.safeParse({ ...form, ...patch }).success).toBe(false);
  });
});

describe('partyByCategory', () => {
  const categories = [
    { id: 'adult', min_age: 12, max_age: null },
    { id: 'child', min_age: 4, max_age: 11 },
    { id: 'infant', min_age: 0, max_age: 3 },
  ];

  it("maps adults and children's ages to the camping's categories, in its order", () => {
    expect(partyByCategory(categories, { adults: 2, childAges: [5, 1, 9] })).toEqual([
      { id: 'adult', count: 2 },
      { id: 'child', count: 2 },
      { id: 'infant', count: 1 },
    ]);
    expect(partyByCategory(categories.slice(0, 2), { adults: 1, childAges: [2] })).toBeNull();
  });
});

describe('lineLabel', () => {
  it('counts nights for per-night lines only', () => {
    expect(
      lineLabel({ kind: 'guest', id: 'adult', quantity: 2, per: 'night', totalCents: 3200 }, 2),
    ).toEqual({
      kind: 'guest',
      id: 'adult',
      quantity: 2,
      nights: 2,
    });
    expect(
      lineLabel({ kind: 'extra', id: 'wood', quantity: 1, per: 'stay', totalCents: 500 }, 2).nights,
    ).toBeNull();
  });
});
