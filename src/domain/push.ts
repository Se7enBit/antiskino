/**
 * Where a tapped push may take the app: a booking of the guest or of the
 * camping's team, or the team's reviews (pushUrl in
 * supabase/functions/_shared/pushMessages.ts). Anything else is ignored.
 */
const PUSH_URL = /^(\/(partner\/)?bookings\/detail\?ref=ANT-[0-9A-Z]{6}|\/partner\/reviews)$/;

export function pushTarget(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const url = (data as Record<string, unknown>).url;
  return typeof url === 'string' && PUSH_URL.test(url) ? url : null;
}
