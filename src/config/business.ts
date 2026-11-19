import type { IsoDate } from '@/lib/dates';

/**
 * The business behind Antiskino, shown in the terms and privacy pages.
 * Placeholders until the business is registered: replace them here, then
 * update LEGAL_UPDATED.
 */
export const BUSINESS = {
  name: '[Business name]',
  taxId: '[Tax ID]',
  address: '[Address]',
  email: '[Contact email]',
} as const;

/** The date the terms and privacy texts last changed. */
export const LEGAL_UPDATED: IsoDate = '2026-11-20';
