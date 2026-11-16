import { z } from 'zod';

import { commissionPercentSchema } from './commission';
import { slugSchema } from './slug';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === '' || z.email().safeParse(value).success)
  .transform((value) => (value === '' ? null : value));

/** New-partner form → partners row. Errors are reported per field name. */
export const partnerFormSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    legalName: optionalText(200),
    vatNumber: optionalText(40),
    billingEmail: optionalEmail,
    commissionPercent: commissionPercentSchema,
  })
  .transform((form) => ({
    name: form.name,
    legal_name: form.legalName,
    vat_number: form.vatNumber,
    billing_email: form.billingEmail,
    commission_bps: form.commissionPercent,
  }));

export type PartnerFormValues = z.input<typeof partnerFormSchema>;
export type PartnerFormField = keyof PartnerFormValues;

/** New-camping form → campings row (without partner_id). */
export const campingFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  region: optionalText(80),
});

export type CampingFormValues = z.input<typeof campingFormSchema>;
export type CampingFormField = keyof CampingFormValues;

/** The first invalid field of each kind, for showing one message per field. */
export function fieldErrors<Field extends string>(error: z.ZodError): Partial<Record<Field, true>> {
  const fields: Partial<Record<Field, true>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string') fields[field as Field] = true;
  }
  return fields;
}
