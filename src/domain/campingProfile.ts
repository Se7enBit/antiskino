import { z } from 'zod';

import type { Database } from '@/api/database.types';

import { AMENITIES, isAmenity } from './amenities';
import { textIn, toLocalized } from './localizedText';
import { isRegion, regionFieldSchema } from './regions';

type CampingRow = Database['public']['Tables']['campings']['Row'];
type CampingUpdate = Database['public']['Tables']['campings']['Update'];

export const CONFIRMATION_MODES = ['instant', 'request'] as const;
export const PAYMENT_MODES = ['on_site', 'deposit', 'full'] as const;
/** Online payments arrive in M7; until then only "on_site" can be chosen. */
export const ENABLED_PAYMENT_MODES = ['on_site'] as const;
export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const COORDINATES = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).transform((v) => (v === '' ? null : v));
const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === '' || TIME.test(v))
  .transform((v) => (v === '' ? null : v));

/** Form state: every field is the text the owner typed (or picked). */
export type CampingProfileForm = {
  name: string;
  shortDescrEl: string;
  shortDescrEn: string;
  descrEl: string;
  descrEn: string;
  houseRulesEl: string;
  houseRulesEn: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  coordinates: string;
  amenities: string[];
  checkInFrom: string;
  checkOutUntil: string;
  sameDayCutoff: string;
  confirmationMode: (typeof CONFIRMATION_MODES)[number];
  requestExpiryHours: string;
  paymentMode: (typeof PAYMENT_MODES)[number];
  cancellationPolicy: (typeof CANCELLATION_POLICIES)[number];
};

export type CampingProfileField = keyof CampingProfileForm;

/** Validates the form and maps it to the columns owners may update. */
export const campingProfileSchema = z
  .object({
    name: text(120).min(1),
    shortDescrEl: text(300),
    shortDescrEn: text(300),
    descrEl: text(5000),
    descrEn: text(5000),
    houseRulesEl: text(3000),
    houseRulesEn: text(3000),
    region: regionFieldSchema,
    address: optional(300),
    phone: optional(40),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === '' || z.email().safeParse(v).success)
      .transform((v) => (v === '' ? null : v)),
    coordinates: z.string().transform((value, ctx) => {
      if (value.trim() === '') return null;
      const match = COORDINATES.exec(value);
      const lat = Number(match?.[1]);
      const lng = Number(match?.[2]);
      if (!match || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        ctx.addIssue({ code: 'custom', message: 'Expected "latitude, longitude"' });
        return z.NEVER;
      }
      return { lat, lng };
    }),
    amenities: z.array(z.enum(AMENITIES)),
    checkInFrom: optionalTime,
    checkOutUntil: optionalTime,
    sameDayCutoff: z.string().trim().regex(TIME),
    confirmationMode: z.enum(CONFIRMATION_MODES),
    requestExpiryHours: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/)
      .transform(Number)
      .pipe(z.number().int().min(2).max(48)),
    paymentMode: z.enum(ENABLED_PAYMENT_MODES),
    cancellationPolicy: z.enum(CANCELLATION_POLICIES),
  })
  .transform((form): CampingUpdate => ({
    name: form.name,
    short_descr: toLocalized(form.shortDescrEl, form.shortDescrEn),
    descr: toLocalized(form.descrEl, form.descrEn),
    house_rules: toLocalized(form.houseRulesEl, form.houseRulesEn),
    region: form.region,
    address: form.address,
    phone: form.phone,
    email: form.email,
    lat: form.coordinates?.lat ?? null,
    lng: form.coordinates?.lng ?? null,
    amenities: form.amenities,
    check_in_from: form.checkInFrom,
    check_out_until: form.checkOutUntil,
    same_day_cutoff: form.sameDayCutoff,
    confirmation_mode: form.confirmationMode,
    request_expiry_hours: form.requestExpiryHours,
    payment_mode: form.paymentMode,
    deposit_percent: null,
    cancellation_policy: form.cancellationPolicy,
  }));

/** "14:00:00" → "14:00". */
const hhmm = (time: string | null) => (time ? time.slice(0, 5) : '');

/** A camping row → the form's initial state. */
export function campingToForm(camping: CampingRow): CampingProfileForm {
  return {
    name: camping.name,
    shortDescrEl: textIn(camping.short_descr, 'el'),
    shortDescrEn: textIn(camping.short_descr, 'en'),
    descrEl: textIn(camping.descr, 'el'),
    descrEn: textIn(camping.descr, 'en'),
    houseRulesEl: textIn(camping.house_rules, 'el'),
    houseRulesEn: textIn(camping.house_rules, 'en'),
    region: isRegion(camping.region) ? camping.region : '',
    address: camping.address ?? '',
    phone: camping.phone ?? '',
    email: camping.email ?? '',
    coordinates:
      camping.lat !== null && camping.lng !== null ? `${camping.lat}, ${camping.lng}` : '',
    amenities: camping.amenities.filter(isAmenity),
    checkInFrom: hhmm(camping.check_in_from),
    checkOutUntil: hhmm(camping.check_out_until),
    sameDayCutoff: hhmm(camping.same_day_cutoff),
    confirmationMode: camping.confirmation_mode,
    requestExpiryHours: String(camping.request_expiry_hours),
    paymentMode: camping.payment_mode,
    cancellationPolicy: camping.cancellation_policy,
  };
}
