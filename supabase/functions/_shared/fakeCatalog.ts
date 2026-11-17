// An in-memory Catalog for handler tests.
import type { SearchCamping } from './api.ts';
import type { CampingRates, Catalog, SellableQuery } from './catalog.ts';

export type FakeData = {
  campings: SearchCamping[];
  rates: Record<string, CampingRates>;
  /** pitch type id → camping id */
  pitchTypes: Record<string, string>;
  sellable: (q: SellableQuery) => { campingId: string; pitchTypeId: string }[];
};

export function fakeCatalog(data: FakeData): Catalog & { queries: SellableQuery[] } {
  const queries: SellableQuery[] = [];
  return {
    queries,
    sellable: (q) => {
      queries.push(q);
      return Promise.resolve(data.sellable(q));
    },
    campings: (ids) => Promise.resolve(data.campings.filter((c) => ids.includes(c.id))),
    rates: (ids) =>
      Promise.resolve(
        new Map(ids.flatMap((id) => (data.rates[id] ? [[id, data.rates[id]!]] : []))),
      ),
    pitchTypeCamping: (id) => Promise.resolve(data.pitchTypes[id] ?? null),
  };
}

export const camping = (id: string, patch: Partial<SearchCamping> = {}): SearchCamping => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  region: 'Halkidiki',
  lat: null,
  lng: null,
  shortDescr: {},
  coverPhoto: null,
  ...patch,
});

/** One season (July 2027) pricing the given pitch types; adults 12+ and children 4–11. */
export function rates(
  pitchPrices: Record<string, number>,
  patch: Partial<CampingRates> = {},
): CampingRates {
  return {
    seasons: [{ id: 's', start: '2027-07-01', end: '2027-08-01' }],
    categories: [
      { id: 'adult', minAge: 12, maxAge: null },
      { id: 'child', minAge: 4, maxAge: 11 },
    ],
    prices: [
      ...Object.entries(pitchPrices).map(([id, amountCents]) => ({
        seasonId: 's',
        itemType: 'pitch' as const,
        itemId: id,
        amountCents,
      })),
      { seasonId: 's', itemType: 'guest', itemId: 'adult', amountCents: 800 },
      { seasonId: 's', itemType: 'guest', itemId: 'child', amountCents: 400 },
    ],
    extras: [],
    fees: [],
    ...patch,
  };
}
