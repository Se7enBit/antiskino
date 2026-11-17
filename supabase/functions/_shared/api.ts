/**
 * Request and response shapes of the `search` and `quote` edge functions.
 * Keep this module free of imports: the app imports these types.
 *
 * Dates are `YYYY-MM-DD` (Europe/Athens); money is integer cents (EUR).
 */

export type Equipment = 'tent' | 'caravan' | 'camper';

/** A stay and party: adults plus each child's age (0–17). */
export type StayQuery = {
  arrival: string;
  departure: string;
  adults: number;
  childAges: number[];
  equipment: Equipment;
};

export type SearchRequest = StayQuery & {
  /** Only campings in this region. */
  region?: string;
  /** Only this camping (its page). */
  campingId?: string;
};

export type SearchCamping = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
  /** jsonb {"el", "en"}; display with localized(). */
  shortDescr: unknown;
  /** Storage path of the first gallery photo. */
  coverPhoto: string | null;
};

export type SearchResult = {
  camping: SearchCamping;
  /** The cheapest sellable pitch type's total for the stay. */
  fromTotalCents: number;
  /** Sellable pitch types and their totals; types not listed are unavailable. */
  pitchTypes: { id: string; totalCents: number }[];
};

export type SearchResponse = { results: SearchResult[] };

export type QuoteRequest = StayQuery & {
  pitchTypeId: string;
  /** Quantity per extra id. */
  extras?: Record<string, number>;
};

/** One priced item over the whole stay. */
export type QuoteLine = {
  kind: 'pitch' | 'guest' | 'extra' | 'fee';
  id: string;
  /** Pitches, guests, extra quantity or people (per-person fees). */
  quantity: number;
  /** Per night (summed over the nights) or once per stay. */
  per: 'night' | 'stay';
  totalCents: number;
};

export type Quote = {
  nights: { night: string; seasonId: string; totalCents: number }[];
  lines: QuoteLine[];
  totalCents: number;
};

export type UnavailableReason =
  /** The pitch type doesn't exist or isn't on sale. */
  | 'not_found'
  /** Not sellable for these dates, equipment or party size. */
  | 'unavailable'
  /** Someone's age fits none of the camping's guest categories. */
  | 'party'
  /** A price the stay needs isn't set. */
  | 'no_price'
  /** An extra isn't offered for this stay, or the quantity is too high. */
  | 'extras';

export type QuoteResponse =
  | { available: true; quote: Quote; offeredExtras: string[] }
  | { available: false; reason: UnavailableReason };

export type ErrorResponse = {
  error: 'invalid_input' | 'unauthorized' | 'method_not_allowed' | 'server_error';
  issues?: { path: string; code: string }[];
};
