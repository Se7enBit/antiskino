/**
 * Prices one stay (SPEC §4.2). Pure: no I/O, integer cents only.
 *
 * For each night n, S = the season containing n:
 *   night_total = pitch(S) + Σ guests[c] × guest(c, S)
 *               + Σ per-night extras[e] × qty × extra(e, S) + per-night fees
 *   stay_total  = Σ night_total + Σ per-stay extras[e] × qty × extra(e, S_arrival) + per-stay fees
 *
 * An item the stay needs without a price in the season is an error: the stay is
 * not sellable (SPEC §0, "Missing prices"). A price of 0 means free.
 */
import type { Quote, QuoteLine } from './api.ts';
import { stayNights, type IsoDate } from './dates.ts';

export type { Quote, QuoteLine };

export type Season = {
  id: string;
  /** First night. */
  start: IsoDate;
  /** Night after the last one (exclusive), as in Postgres daterange. */
  end: IsoDate;
};
export type PriceItemType = 'pitch' | 'guest' | 'extra';
export type Price = {
  seasonId: string;
  itemType: PriceItemType;
  itemId: string;
  amountCents: number;
};
export type Extra = { id: string; unit: 'per_night' | 'per_stay'; maxQty: number };
export type Fee = {
  id: string;
  unit: 'per_person_night' | 'per_pitch_night' | 'per_stay';
  amountCents: number;
};

/** Everything that prices stays at one camping. */
export type RateCard = { seasons: Season[]; prices: Price[]; extras: Extra[]; fees: Fee[] };

export type StayRequest = {
  pitchTypeId: string;
  arrival: IsoDate;
  departure: IsoDate;
  /** Guests per guest category id (see party.ts). */
  guests: Record<string, number>;
  /** Quantity per extra id; zero quantities are ignored. */
  extras?: Record<string, number>;
};

export type PricingError =
  | { code: 'no_nights' }
  | { code: 'no_season'; night: IsoDate }
  | { code: 'no_price'; itemType: PriceItemType; itemId: string; seasonId: string }
  | { code: 'unknown_extra'; extraId: string }
  | { code: 'too_many'; extraId: string };

export type PricingResult = { ok: true; quote: Quote } | { ok: false; error: PricingError };

class PricingFailure extends Error {
  constructor(readonly error: PricingError) {
    super(error.code);
  }
}

function safeAdd(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError('Amount out of range');
  return sum;
}

function times(cents: number, quantity: number): number {
  const product = cents * quantity;
  if (!Number.isSafeInteger(product)) throw new RangeError('Amount out of range');
  return product;
}

export function seasonOf(seasons: Season[], night: IsoDate): Season | undefined {
  // YYYY-MM-DD strings compare like dates.
  return seasons.find((s) => night >= s.start && night < s.end);
}

function priceIndex(prices: Price[]): Map<string, number> {
  return new Map(prices.map((p) => [`${p.seasonId}:${p.itemType}:${p.itemId}`, p.amountCents]));
}

export function priceStay(rates: RateCard, request: StayRequest): PricingResult {
  try {
    return { ok: true, quote: buildQuote(rates, request) };
  } catch (e) {
    if (e instanceof PricingFailure) return { ok: false, error: e.error };
    throw e;
  }
}

function buildQuote(rates: RateCard, request: StayRequest): Quote {
  const nights = stayNights(request.arrival, request.departure);
  if (nights.length === 0) throw new PricingFailure({ code: 'no_nights' });

  const index = priceIndex(rates.prices);
  const priceOf = (season: Season, itemType: PriceItemType, itemId: string): number => {
    const amount = index.get(`${season.id}:${itemType}:${itemId}`);
    if (amount === undefined)
      throw new PricingFailure({ code: 'no_price', itemType, itemId, seasonId: season.id });
    return amount;
  };

  const guests = Object.entries(request.guests).filter(([, count]) => count > 0);
  const people = guests.reduce((sum, [, count]) => sum + count, 0);
  const extras = Object.entries(request.extras ?? {})
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const extra = rates.extras.find((e) => e.id === id);
      if (!extra) throw new PricingFailure({ code: 'unknown_extra', extraId: id });
      if (qty > extra.maxQty) throw new PricingFailure({ code: 'too_many', extraId: id });
      return { extra, qty };
    });

  // Totals per line, keyed by kind and id.
  const lines = new Map<string, QuoteLine>();
  const add = (line: Omit<QuoteLine, 'totalCents'>, cents: number) => {
    const key = `${line.kind}:${line.id}`;
    const current = lines.get(key);
    lines.set(key, { ...line, totalCents: safeAdd(current?.totalCents ?? 0, cents) });
    return cents;
  };

  const nightTotals = nights.map((night) => {
    const season = seasonOf(rates.seasons, night);
    if (!season) throw new PricingFailure({ code: 'no_season', night });
    let total = add(
      { kind: 'pitch', id: request.pitchTypeId, quantity: 1, per: 'night' },
      priceOf(season, 'pitch', request.pitchTypeId),
    );
    for (const [categoryId, count] of guests) {
      total = safeAdd(
        total,
        add(
          { kind: 'guest', id: categoryId, quantity: count, per: 'night' },
          times(priceOf(season, 'guest', categoryId), count),
        ),
      );
    }
    for (const { extra, qty } of extras) {
      if (extra.unit !== 'per_night') continue;
      total = safeAdd(
        total,
        add(
          { kind: 'extra', id: extra.id, quantity: qty, per: 'night' },
          times(priceOf(season, 'extra', extra.id), qty),
        ),
      );
    }
    for (const fee of rates.fees) {
      if (fee.unit === 'per_stay') continue;
      const quantity = fee.unit === 'per_person_night' ? people : 1;
      total = safeAdd(
        total,
        add({ kind: 'fee', id: fee.id, quantity, per: 'night' }, times(fee.amountCents, quantity)),
      );
    }
    return { night, seasonId: season.id, totalCents: total };
  });

  const arrivalSeason = seasonOf(rates.seasons, request.arrival)!;
  let total = nightTotals.reduce((sum, n) => safeAdd(sum, n.totalCents), 0);
  for (const { extra, qty } of extras) {
    if (extra.unit !== 'per_stay') continue;
    total = safeAdd(
      total,
      add(
        { kind: 'extra', id: extra.id, quantity: qty, per: 'stay' },
        times(priceOf(arrivalSeason, 'extra', extra.id), qty),
      ),
    );
  }
  for (const fee of rates.fees) {
    if (fee.unit !== 'per_stay') continue;
    total = safeAdd(
      total,
      add({ kind: 'fee', id: fee.id, quantity: 1, per: 'stay' }, fee.amountCents),
    );
  }

  return { nights: nightTotals, lines: [...lines.values()], totalCents: total };
}

/**
 * Extras that can be offered for a stay: per-night extras priced in every
 * night's season, per-stay extras priced in the arrival night's season.
 */
export function offeredExtras(rates: RateCard, arrival: IsoDate, departure: IsoDate): Extra[] {
  const index = priceIndex(rates.prices);
  const seasons = stayNights(arrival, departure).map((night) => seasonOf(rates.seasons, night));
  if (seasons.length === 0 || seasons.some((s) => !s)) return [];
  const has = (season: Season | undefined, extraId: string) =>
    season !== undefined && index.has(`${season.id}:extra:${extraId}`);
  return rates.extras.filter((extra) =>
    extra.unit === 'per_stay' ? has(seasons[0], extra.id) : seasons.every((s) => has(s, extra.id)),
  );
}

/** "[2027-07-01,2027-09-01)" → { start, end }, or null for any other shape. */
export function parseDateRange(range: unknown): { start: IsoDate; end: IsoDate } | null {
  if (typeof range !== 'string') return null;
  const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(range);
  return match ? { start: match[1]!, end: match[2]! } : null;
}
