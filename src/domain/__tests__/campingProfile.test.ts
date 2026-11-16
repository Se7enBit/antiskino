import type { Database } from '@/api/database.types';

import { campingProfileSchema, campingToForm, type CampingProfileForm } from '../campingProfile';

type CampingRow = Database['public']['Tables']['campings']['Row'];

const row: CampingRow = {
  id: 'c1',
  partner_id: 'p1',
  slug: 'demo-thalassa',
  status: 'live',
  name: 'Camping Thalassa',
  short_descr: { el: 'Δίπλα στη θάλασσα.', en: 'By the sea.' },
  descr: { en: 'Pine trees and sand.' },
  house_rules: {},
  region: 'Halkidiki',
  address: null,
  lat: 40.0915,
  lng: 23.98,
  phone: '+30 2375 000000',
  email: 'info@example.gr',
  amenities: ['wifi', 'pool', 'retired_amenity'],
  check_in_from: '14:00:00',
  check_out_until: '12:00:00',
  same_day_cutoff: '14:00:00',
  confirmation_mode: 'instant',
  request_expiry_hours: 24,
  payment_mode: 'on_site',
  deposit_percent: null,
  cancellation_policy: 'moderate',
  created_at: '2026-11-16T10:00:00Z',
  updated_at: '2026-11-16T10:00:00Z',
};

describe('campingToForm', () => {
  it('turns a camping row into form text', () => {
    const form = campingToForm(row);
    expect(form).toMatchObject({
      shortDescrEl: 'Δίπλα στη θάλασσα.',
      shortDescrEn: 'By the sea.',
      descrEl: '',
      descrEn: 'Pine trees and sand.',
      address: '',
      coordinates: '40.0915, 23.98',
      checkInFrom: '14:00',
      sameDayCutoff: '14:00',
      requestExpiryHours: '24',
    });
    // Keys no longer on the fixed list are dropped.
    expect(form.amenities).toEqual(['wifi', 'pool']);
  });

  it('round-trips through the schema to the same columns', () => {
    const update = campingProfileSchema.parse(campingToForm(row));
    expect(update).toMatchObject({
      name: 'Camping Thalassa',
      short_descr: { el: 'Δίπλα στη θάλασσα.', en: 'By the sea.' },
      descr: { en: 'Pine trees and sand.' },
      house_rules: {},
      address: null,
      lat: 40.0915,
      lng: 23.98,
      check_in_from: '14:00',
      request_expiry_hours: 24,
      payment_mode: 'on_site',
      deposit_percent: null,
      cancellation_policy: 'moderate',
    });
  });
});

describe('campingProfileSchema', () => {
  const valid = (): CampingProfileForm => campingToForm(row);
  const fails = (patch: Partial<CampingProfileForm>) =>
    campingProfileSchema.safeParse({ ...valid(), ...patch }).success === false;

  it('accepts coordinates pasted from a maps app', () => {
    const update = campingProfileSchema.parse({ ...valid(), coordinates: ' 40.08123,23.9712 ' });
    expect([update.lat, update.lng]).toEqual([40.08123, 23.9712]);
    expect(campingProfileSchema.parse({ ...valid(), coordinates: '' }).lat).toBeNull();
  });

  it('rejects coordinates that are not "lat, lng" on Earth', () => {
    expect(fails({ coordinates: '40.08' })).toBe(true);
    expect(fails({ coordinates: '95, 23' })).toBe(true);
    expect(fails({ coordinates: 'Sarti' })).toBe(true);
  });

  it('checks times, the request expiry and the email', () => {
    expect(fails({ checkInFrom: '25:00' })).toBe(true);
    expect(fails({ sameDayCutoff: '' })).toBe(true);
    expect(fails({ requestExpiryHours: '1' })).toBe(true);
    expect(fails({ requestExpiryHours: '49' })).toBe(true);
    expect(fails({ requestExpiryHours: '12.5' })).toBe(true);
    expect(fails({ email: 'info' })).toBe(true);
    expect(fails({ name: '  ' })).toBe(true);
    expect(fails({ amenities: ['jacuzzi'] })).toBe(true);
  });

  it('keeps online payment modes off until M7', () => {
    expect(fails({ paymentMode: 'deposit' })).toBe(true);
    expect(fails({ paymentMode: 'full' })).toBe(true);
  });
});
