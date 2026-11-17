import { z } from 'zod';

import { addDays, formatDateInput, type IsoDate } from '@/lib/dates';
import { eurosInputSchema } from '@/lib/money';

import { dateInput, text, wholeNumber } from './formFields';
import { textIn, toLocalized } from './localizedText';

export const EXTRA_UNITS = ['per_night', 'per_stay'] as const;
export const FEE_UNITS = ['per_person_night', 'per_pitch_night', 'per_stay'] as const;
export const PRICE_ITEM_TYPES = ['pitch', 'guest', 'extra'] as const;
export type PriceItemType = (typeof PRICE_ITEM_TYPES)[number];

const hasName = (form: { nameEl: string; nameEn: string }) =>
  form.nameEl !== '' || form.nameEn !== '';
const names = z.object({ nameEl: z.string(), nameEn: z.string() });
const NAME_REQUIRED = {
  path: ['nameEl'],
  // Check the name even when other fields fail, so every error shows at once.
  when: (payload: { value: unknown }) => names.safeParse(payload.value).success,
};

// ---------------------------------------------------------------------------
// Night ranges: the form uses first and last night; Postgres stores [first, last + 1)
// ---------------------------------------------------------------------------

export function toNightRange(firstNight: IsoDate, lastNight: IsoDate): string {
  return `[${firstNight},${addDays(lastNight, 1)})`;
}

/** "[2027-07-01,2027-09-01)" → first and last night (2027-07-01 … 2027-08-31). */
export function parseNightRange(
  range: unknown,
): { firstNight: IsoDate; lastNight: IsoDate } | null {
  if (typeof range !== 'string') return null;
  const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(range);
  if (!match) return null;
  return { firstNight: match[1]!, lastNight: addDays(match[2]!, -1) };
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export type SeasonForm = {
  nameEl: string;
  nameEn: string;
  firstNight: string;
  lastNight: string;
  minNights: string;
};
export const EMPTY_SEASON: SeasonForm = {
  nameEl: '',
  nameEn: '',
  firstNight: '',
  lastNight: '',
  minNights: '1',
};

export const seasonFormSchema = z
  .object({
    nameEl: text(60),
    nameEn: text(60),
    firstNight: dateInput,
    lastNight: dateInput,
    minNights: wholeNumber(1, 30),
  })
  .refine(hasName, NAME_REQUIRED)
  .refine((f) => f.lastNight >= f.firstNight, { path: ['lastNight'] })
  .transform((f) => ({
    name: toLocalized(f.nameEl, f.nameEn),
    dates: toNightRange(f.firstNight, f.lastNight),
    min_nights: f.minNights,
  }));

export function seasonToForm(row: {
  name: unknown;
  /** daterange; the generated types call it unknown. */
  dates: unknown;
  min_nights: number;
}): SeasonForm {
  const range = parseNightRange(row.dates);
  return {
    nameEl: textIn(row.name, 'el'),
    nameEn: textIn(row.name, 'en'),
    firstNight: range ? formatDateInput(range.firstNight) : '',
    lastNight: range ? formatDateInput(range.lastNight) : '',
    minNights: String(row.min_nights),
  };
}

// ---------------------------------------------------------------------------
// Guest categories
// ---------------------------------------------------------------------------

export type GuestCategoryForm = { nameEl: string; nameEn: string; minAge: string; maxAge: string };
export const EMPTY_GUEST_CATEGORY: GuestCategoryForm = {
  nameEl: '',
  nameEn: '',
  minAge: '0',
  maxAge: '',
};

export const guestCategoryFormSchema = z
  .object({
    nameEl: text(60),
    nameEn: text(60),
    minAge: wholeNumber(0, 120),
    maxAge: z
      .string()
      .trim()
      .pipe(z.union([z.literal('').transform(() => null), wholeNumber(0, 120)])),
  })
  .refine(hasName, NAME_REQUIRED)
  .refine((f) => f.maxAge === null || f.maxAge >= f.minAge, { path: ['maxAge'] })
  .transform((f) => ({
    name: toLocalized(f.nameEl, f.nameEn),
    min_age: f.minAge,
    max_age: f.maxAge,
  }));

export function guestCategoryToForm(row: {
  name: unknown;
  min_age: number;
  max_age: number | null;
}): GuestCategoryForm {
  return {
    nameEl: textIn(row.name, 'el'),
    nameEn: textIn(row.name, 'en'),
    minAge: String(row.min_age),
    maxAge: row.max_age === null ? '' : String(row.max_age),
  };
}

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------

export type ExtraForm = {
  nameEl: string;
  nameEn: string;
  unit: (typeof EXTRA_UNITS)[number];
  maxQty: string;
  active: boolean;
};
export const EMPTY_EXTRA: ExtraForm = {
  nameEl: '',
  nameEn: '',
  unit: 'per_night',
  maxQty: '1',
  active: true,
};

export const extraFormSchema = z
  .object({
    nameEl: text(60),
    nameEn: text(60),
    unit: z.enum(EXTRA_UNITS),
    maxQty: wholeNumber(1, 20),
    active: z.boolean(),
  })
  .refine(hasName, NAME_REQUIRED)
  .transform((f) => ({
    name: toLocalized(f.nameEl, f.nameEn),
    unit: f.unit,
    max_qty: f.maxQty,
    active: f.active,
  }));

export function extraToForm(row: {
  name: unknown;
  unit: ExtraForm['unit'];
  max_qty: number;
  active: boolean;
}): ExtraForm {
  return {
    nameEl: textIn(row.name, 'el'),
    nameEn: textIn(row.name, 'en'),
    unit: row.unit,
    maxQty: String(row.max_qty),
    active: row.active,
  };
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export type FeeForm = {
  nameEl: string;
  nameEn: string;
  unit: (typeof FEE_UNITS)[number];
  amount: string;
};
export const EMPTY_FEE: FeeForm = { nameEl: '', nameEn: '', unit: 'per_person_night', amount: '' };

export const feeFormSchema = z
  .object({
    nameEl: text(60),
    nameEn: text(60),
    unit: z.enum(FEE_UNITS),
    amount: eurosInputSchema.pipe(z.number()),
  })
  .refine(hasName, NAME_REQUIRED)
  .transform((f) => ({
    name: toLocalized(f.nameEl, f.nameEn),
    unit: f.unit,
    amount_cents: f.amount,
  }));

// ---------------------------------------------------------------------------
// Price grid of one season
// ---------------------------------------------------------------------------

export type PriceKey = `${PriceItemType}:${string}`;
export const priceKey = (itemType: PriceItemType, itemId: string): PriceKey =>
  `${itemType}:${itemId}`;

export type PriceRow = { item_type: PriceItemType; item_id: string; amount_cents: number };

/** Form text per item → the list set_season_prices() takes; empty fields are left out. */
export function pricesFromForm(
  values: Record<PriceKey, string>,
): { ok: true; prices: PriceRow[] } | { ok: false; invalid: PriceKey[] } {
  const prices: PriceRow[] = [];
  const invalid: PriceKey[] = [];
  for (const [key, value] of Object.entries(values) as [PriceKey, string][]) {
    const parsed = eurosInputSchema.safeParse(value);
    if (!parsed.success) invalid.push(key);
    else if (parsed.data !== null) {
      const [itemType, itemId] = key.split(/:(.*)/s) as [PriceItemType, string];
      prices.push({ item_type: itemType, item_id: itemId, amount_cents: parsed.data });
    }
  }
  return invalid.length ? { ok: false, invalid } : { ok: true, prices };
}
