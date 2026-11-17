import { z } from 'zod';

import type { Database } from '@/api/database.types';

import { textIn, toLocalized } from './localizedText';

type PitchTypeRow = Database['public']['Tables']['pitch_types']['Row'];

export const EQUIPMENT = ['tent', 'caravan', 'camper'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type PitchTypeForm = {
  nameEl: string;
  nameEn: string;
  descrEl: string;
  descrEn: string;
  includedEl: string;
  includedEn: string;
  accepts: Equipment[];
  maxPeople: string;
  sizeM2: string;
  active: boolean;
};

export type PitchTypeField = keyof PitchTypeForm;

export const EMPTY_PITCH_TYPE: PitchTypeForm = {
  nameEl: '',
  nameEn: '',
  descrEl: '',
  descrEn: '',
  includedEl: '',
  includedEn: '',
  accepts: ['tent'],
  maxPeople: '4',
  sizeM2: '',
  active: true,
};

const text = (max: number) => z.string().trim().max(max);
const wholeNumber = (min: number, max: number) =>
  z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));

/** Validates the form and maps it to pitch_types columns. */
export const pitchTypeFormSchema = z
  .object({
    nameEl: text(80),
    nameEn: text(80),
    descrEl: text(2000),
    descrEn: text(2000),
    includedEl: text(1000),
    includedEn: text(1000),
    accepts: z.array(z.enum(EQUIPMENT)).min(1),
    maxPeople: wholeNumber(1, 50),
    sizeM2: z
      .string()
      .trim()
      .pipe(z.union([z.literal('').transform(() => null), wholeNumber(1, 10000)])),
    active: z.boolean(),
  })
  .refine((form) => form.nameEl !== '' || form.nameEn !== '', { path: ['nameEl'] })
  .transform((form) => ({
    name: toLocalized(form.nameEl, form.nameEn),
    descr: toLocalized(form.descrEl, form.descrEn),
    included: toLocalized(form.includedEl, form.includedEn),
    accepts: EQUIPMENT.filter((e) => form.accepts.includes(e)),
    max_people: form.maxPeople,
    size_m2: form.sizeM2,
    active: form.active,
  }));

export type PitchTypeValues = z.output<typeof pitchTypeFormSchema>;

export function pitchTypeToForm(row: PitchTypeRow): PitchTypeForm {
  return {
    nameEl: textIn(row.name, 'el'),
    nameEn: textIn(row.name, 'en'),
    descrEl: textIn(row.descr, 'el'),
    descrEn: textIn(row.descr, 'en'),
    includedEl: textIn(row.included, 'el'),
    includedEn: textIn(row.included, 'en'),
    accepts: [...row.accepts],
    maxPeople: String(row.max_people),
    sizeM2: row.size_m2 === null ? '' : String(row.size_m2),
    active: row.active,
  };
}
