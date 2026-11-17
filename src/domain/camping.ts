import { parseNightRange } from './rates';

import type { IsoDate } from '@/lib/dates';

/**
 * The lowest pitch price of a pitch type in the seasons that haven't ended,
 * for "from €X / night" when no dates are picked (SPEC F2). Display only:
 * totals for a stay always come from the server.
 */
export function pitchFromCents(
  pitchTypeId: string,
  seasons: { id: string; dates: unknown }[],
  prices: { season_id: string; item_id: string; amount_cents: number }[],
  today: IsoDate,
): number | null {
  const current = new Set(
    seasons.filter((s) => (parseNightRange(s.dates)?.lastNight ?? '') >= today).map((s) => s.id),
  );
  const amounts = prices
    .filter((p) => p.item_id === pitchTypeId && current.has(p.season_id))
    .map((p) => p.amount_cents);
  return amounts.length ? Math.min(...amounts) : null;
}

/** A maps link with driving directions: Apple Maps on iOS, Google Maps elsewhere. */
export function directionsUrl(lat: number, lng: number, os: string): string {
  const destination = `${lat},${lng}`;
  return os === 'ios'
    ? `https://maps.apple.com/?daddr=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/** "14:00:00" → "14:00". */
export function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}
