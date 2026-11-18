import type { IsoDate } from '@/lib/dates';

type TodayBooking = {
  status: string;
  arrival: IsoDate;
  departure: IsoDate;
  party_size: number;
  arrival_eta: string | null;
  request_expires_at: string | null;
};

export type TodayGroups<T> = {
  /** Arriving today, plus guests from earlier days who are still to be checked in. */
  arrivals: T[];
  /** Checked in and leaving today. */
  departures: T[];
  /** Checked in and staying tonight. */
  inHouse: { stays: number; people: number };
  /** Requests waiting for an answer, the soonest deadline first. */
  requests: T[];
};

/** Reception's day (SPEC F11 Today) from the stays that end today or later. */
export function todayGroups<T extends TodayBooking>(bookings: T[], today: IsoDate): TodayGroups<T> {
  const arrivals = bookings
    .filter(
      (b) =>
        (b.arrival === today && ['confirmed', 'checked_in', 'no_show'].includes(b.status)) ||
        (b.arrival < today && b.departure > today && b.status === 'confirmed'),
    )
    // Late guests first, then by expected time (unknown last).
    .sort(
      (a, b) =>
        a.arrival.localeCompare(b.arrival) ||
        (a.arrival_eta ?? '99').localeCompare(b.arrival_eta ?? '99'),
    );
  const departures = bookings.filter((b) => b.departure === today && b.status === 'checked_in');
  const staying = bookings.filter(
    (b) => b.status === 'checked_in' && b.arrival <= today && b.departure > today,
  );
  const requests = bookings
    .filter((b) => b.status === 'requested')
    .sort((a, b) => (a.request_expires_at ?? '').localeCompare(b.request_expires_at ?? ''));
  return {
    arrivals,
    departures,
    inHouse: { stays: staying.length, people: staying.reduce((sum, b) => sum + b.party_size, 0) },
    requests,
  };
}

/** Hours and minutes until a deadline (rounded up), or null once it has passed. */
export function timeLeft(deadline: string, now: Date): { hours: number; minutes: number } | null {
  const ms = Date.parse(deadline) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMinutes = Math.ceil(ms / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
