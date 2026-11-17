import type { Database } from '@/api/database.types';

import {
  EMPTY_PITCH_TYPE,
  pitchTypeFormSchema,
  pitchTypeToForm,
  type PitchTypeForm,
} from '../pitchTypes';

const form = (patch: Partial<PitchTypeForm> = {}): PitchTypeForm => ({
  ...EMPTY_PITCH_TYPE,
  nameEl: 'Θέση σκηνής',
  ...patch,
});

describe('pitchTypeFormSchema', () => {
  it('maps the form to pitch_types columns', () => {
    expect(
      pitchTypeFormSchema.parse(
        form({
          nameEn: 'Tent pitch',
          includedEn: ' Showers ',
          accepts: ['camper', 'caravan'],
          maxPeople: '6',
          sizeM2: '80',
        }),
      ),
    ).toEqual({
      name: { el: 'Θέση σκηνής', en: 'Tent pitch' },
      descr: {},
      included: { en: 'Showers' },
      accepts: ['caravan', 'camper'],
      max_people: 6,
      size_m2: 80,
      active: true,
    });
  });

  it('allows an empty size', () => {
    expect(pitchTypeFormSchema.parse(form({ sizeM2: ' ' })).size_m2).toBeNull();
  });

  it.each<[string, Partial<PitchTypeForm>]>([
    ['a missing name', { nameEl: '', nameEn: ' ' }],
    ['no equipment', { accepts: [] }],
    ['zero people', { maxPeople: '0' }],
    ['too many people', { maxPeople: '51' }],
    ['a fractional size', { sizeM2: '12.5' }],
  ])('rejects %s', (_, patch) => {
    expect(pitchTypeFormSchema.safeParse(form(patch)).success).toBe(false);
  });
});

describe('pitchTypeToForm', () => {
  it('round-trips a stored pitch type', () => {
    const row: Database['public']['Tables']['pitch_types']['Row'] = {
      id: 'pt1',
      camping_id: 'c1',
      unit_category: 'pitch',
      name: { el: 'Θέση', en: 'Pitch' },
      descr: {},
      included: { el: 'Ρεύμα' },
      accepts: ['caravan', 'camper'],
      max_people: 6,
      size_m2: null,
      photos: [],
      active: false,
      sort: 0,
      created_at: '2026-11-16T10:00:00Z',
      updated_at: '2026-11-16T10:00:00Z',
    };
    const values = pitchTypeFormSchema.parse(pitchTypeToForm(row));
    expect(values).toEqual({
      name: row.name,
      descr: {},
      included: row.included,
      accepts: row.accepts,
      max_people: 6,
      size_m2: null,
      active: false,
    });
  });
});
