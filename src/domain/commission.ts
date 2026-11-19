import { z } from 'zod';

import type { Language } from '@/i18n/languages';

const PERCENT = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;

/**
 * Commission typed as a percentage ("6", "5.5", "5,25") → basis points
 * (600, 550, 525). Empty means "no override" (null). Integer math only.
 */
export const commissionPercentSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const match = PERCENT.exec(value);
    const bps = match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : NaN;
    if (!(bps >= 0 && bps <= 10_000)) {
      ctx.addIssue({ code: 'custom', message: 'Expected a percentage from 0 to 100' });
      return z.NEVER;
    }
    return bps;
  });

/** 600 → "6%", 550 → "5,5%" (el) / "5.5%" (en). */
export function formatBps(bps: number, language: Language): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  const separator = language === 'el' ? ',' : '.';
  return `${whole}${fraction ? separator + fraction : ''}%`;
}

/** Basis points back to the text shown in the form field ("" for no override). */
export function bpsToPercentInput(bps: number | null, language: Language): string {
  return bps === null ? '' : formatBps(bps, language).replace('%', '');
}

/** One completed stay in a month's statement. */
export type CommissionLine = {
  partnerId: string;
  partnerName: string;
  campingName: string;
  ref: string;
  arrival: string;
  departure: string;
  nights: number;
  totalCents: number;
  commissionBps: number;
  commissionCents: number;
};

export type PartnerCommission = {
  partnerId: string;
  partnerName: string;
  stays: number;
  staysCents: number;
  commissionCents: number;
};

/** Each partner's completed stays, their value and the commission due, by partner name. */
export function summarizeCommission(lines: CommissionLine[]): PartnerCommission[] {
  const byPartner = new Map<string, PartnerCommission>();
  for (const line of lines) {
    const row = byPartner.get(line.partnerId) ?? {
      partnerId: line.partnerId,
      partnerName: line.partnerName,
      stays: 0,
      staysCents: 0,
      commissionCents: 0,
    };
    row.stays += 1;
    row.staysCents += line.totalCents;
    row.commissionCents += line.commissionCents;
    byPartner.set(line.partnerId, row);
  }
  return [...byPartner.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

/** Cents as a plain amount for spreadsheets: 1234 → "12,34" (el) / "12.34" (en). */
function amount(cents: number, language: Language): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const separator = language === 'el' ? ',' : '.';
  return `${sign}${Math.trunc(abs / 100)}${separator}${String(abs % 100).padStart(2, '0')}`;
}

function csvField(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * A month's stays as CSV for a spreadsheet: semicolons (as Greek Excel
 * expects), decimal amounts in the language's style, and a byte-order mark so
 * Greek letters open correctly.
 */
export function commissionCsv(
  lines: CommissionLine[],
  headers: [string, string, string, string, string, string, string, string, string],
  language: Language,
): string {
  const rows = [...lines]
    .sort(
      (a, b) =>
        a.partnerName.localeCompare(b.partnerName) || a.departure.localeCompare(b.departure),
    )
    .map((l) => [
      l.partnerName,
      l.campingName,
      l.ref,
      l.arrival,
      l.departure,
      String(l.nights),
      amount(l.totalCents, language),
      formatBps(l.commissionBps, language),
      amount(l.commissionCents, language),
    ]);
  return `﻿${[headers, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n')}\r\n`;
}
