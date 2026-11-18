import { addDays, parseDateInput, type IsoDate } from '@/lib/dates';

/** How far back the Bookings list goes by default (past and cancelled stays). */
export const PAST_DAYS = 60;

/** Stays that overlap these days: departure on or after `from`, arrival on or before `to`. */
export type BookingRange = { from: IsoDate; to: IsoDate | null };

export function defaultRange(today: IsoDate): BookingRange {
  return { from: addDays(today, -PAST_DAYS), to: null };
}

/** The From / To fields of the list filters; empty fields keep the default range. */
export function parseRange(
  fromText: string,
  toText: string,
  today: IsoDate,
): { range: BookingRange } | { error: 'from' | 'to' } {
  const from = fromText.trim() ? parseDateInput(fromText) : defaultRange(today).from;
  if (!from) return { error: 'from' };
  const to = toText.trim() ? parseDateInput(toText) : null;
  if (toText.trim() && (!to || to < from)) return { error: 'to' };
  return { range: { from, to } };
}

export const STATUS_FILTERS = [
  'all',
  'requested',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled',
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** "cancelled" also covers declined and expired requests: nothing is booked for any of them. */
export function matchesStatus(status: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'cancelled') return ['cancelled', 'declined', 'expired'].includes(status);
  return status === filter;
}

/** Lower case without accents, so "μαρια" finds "Μαρία". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el');
}

/** The guest's name or the reference contains the text (ignoring case and accents). */
export function matchesSearch(booking: { guest_name: string; ref: string }, text: string): boolean {
  const needle = fold(text.trim());
  if (!needle) return true;
  return fold(booking.guest_name).includes(needle) || fold(booking.ref).includes(needle);
}

export type BookingFilter = { status: StatusFilter; text: string };

export function filterBookings<T extends { status: string; guest_name: string; ref: string }>(
  bookings: T[],
  filter: BookingFilter,
): T[] {
  return bookings.filter(
    (b) => matchesStatus(b.status, filter.status) && matchesSearch(b, filter.text),
  );
}

export type ReceptionAction = 'accept' | 'decline' | 'check_in' | 'no_show' | 'cancel';

/**
 * What the camping can do with a booking now (SPEC §4.3): answer a request;
 * cancel a confirmed stay; check in or mark a no-show from the arrival day.
 */
export function receptionActions(
  booking: { status: string; arrival: IsoDate },
  today: IsoDate,
): ReceptionAction[] {
  if (booking.status === 'requested') return ['accept', 'decline'];
  if (booking.status !== 'confirmed') return [];
  return booking.arrival <= today ? ['check_in', 'no_show', 'cancel'] : ['cancel'];
}
