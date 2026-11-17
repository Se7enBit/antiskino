import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { offeredExtras, parseDateRange, priceStay, type RateCard } from './pricing.ts';

// A camping with a low season (June, min 1) and a high season (July–August).
// Prices in cents: tent pitch 1000 / 1500, adult 800 / 1000, child 400 / 500,
// car per night 300 / 300, firewood per stay 500 (low) / 700 (high), electricity
// per night priced in the low season only.
const RATES: RateCard = {
  seasons: [
    { id: 'low', start: '2027-06-01', end: '2027-07-01' },
    { id: 'high', start: '2027-07-01', end: '2027-09-01' },
  ],
  prices: [
    ...['low', 'high'].flatMap((s, i) => [
      { seasonId: s, itemType: 'pitch' as const, itemId: 'tent', amountCents: [1000, 1500][i]! },
      { seasonId: s, itemType: 'guest' as const, itemId: 'adult', amountCents: [800, 1000][i]! },
      { seasonId: s, itemType: 'guest' as const, itemId: 'child', amountCents: [400, 500][i]! },
      { seasonId: s, itemType: 'extra' as const, itemId: 'car', amountCents: 300 },
      { seasonId: s, itemType: 'extra' as const, itemId: 'wood', amountCents: [500, 700][i]! },
    ]),
    { seasonId: 'low', itemType: 'extra', itemId: 'power', amountCents: 400 },
  ],
  extras: [
    { id: 'car', unit: 'per_night', maxQty: 2 },
    { id: 'wood', unit: 'per_stay', maxQty: 3 },
    { id: 'power', unit: 'per_night', maxQty: 1 },
  ],
  fees: [],
};
const stay = { pitchTypeId: 'tent', guests: { adult: 2, child: 1 } };

Deno.test('prices each night by its own season across a season boundary', () => {
  const result = priceStay(RATES, { ...stay, arrival: '2027-06-29', departure: '2027-07-02' });
  if (!result.ok) throw new Error(result.error.code);
  // low night: 1000 + 2×800 + 400 = 3000; high night: 1500 + 2×1000 + 500 = 4000
  assertEquals(result.quote.nights, [
    { night: '2027-06-29', seasonId: 'low', totalCents: 3000 },
    { night: '2027-06-30', seasonId: 'low', totalCents: 3000 },
    { night: '2027-07-01', seasonId: 'high', totalCents: 4000 },
  ]);
  assertEquals(result.quote.totalCents, 10000);
  assertEquals(result.quote.lines, [
    { kind: 'pitch', id: 'tent', quantity: 1, per: 'night', totalCents: 3500 },
    { kind: 'guest', id: 'adult', quantity: 2, per: 'night', totalCents: 5200 },
    { kind: 'guest', id: 'child', quantity: 1, per: 'night', totalCents: 1300 },
  ]);
});

Deno.test('counts per-stay extras once, at the arrival season price', () => {
  const result = priceStay(RATES, {
    ...stay,
    arrival: '2027-06-30',
    departure: '2027-07-03',
    extras: { car: 1, wood: 2, power: 0 },
  });
  if (!result.ok) throw new Error(result.error.code);
  const extraLines = result.quote.lines.filter((l) => l.kind === 'extra');
  assertEquals(extraLines, [
    { kind: 'extra', id: 'car', quantity: 1, per: 'night', totalCents: 900 },
    { kind: 'extra', id: 'wood', quantity: 2, per: 'stay', totalCents: 1000 },
  ]);
  // nights 3000 + 4000 + 4000 plus car 3 × 300 = 11900; firewood 2 × 500 once
  assertEquals(result.quote.totalCents, 11900 + 1000);
});

Deno.test('applies fees by unit', () => {
  const rates: RateCard = {
    ...RATES,
    fees: [
      { id: 'tax', unit: 'per_person_night', amountCents: 50 },
      { id: 'eco', unit: 'per_pitch_night', amountCents: 100 },
      { id: 'clean', unit: 'per_stay', amountCents: 250 },
    ],
  };
  const result = priceStay(rates, { ...stay, arrival: '2027-07-01', departure: '2027-07-03' });
  if (!result.ok) throw new Error(result.error.code);
  assertEquals(
    result.quote.lines.filter((l) => l.kind === 'fee'),
    [
      { kind: 'fee', id: 'tax', quantity: 3, per: 'night', totalCents: 300 },
      { kind: 'fee', id: 'eco', quantity: 1, per: 'night', totalCents: 200 },
      { kind: 'fee', id: 'clean', quantity: 1, per: 'stay', totalCents: 250 },
    ],
  );
  // 2 high nights at 4000 + per-night fees (150 + 100) each, + 250 once
  assertEquals(
    result.quote.nights.map((n) => n.totalCents),
    [4250, 4250],
  );
  assertEquals(result.quote.totalCents, 8750);
});

Deno.test('the total always equals the sum of the lines', () => {
  const result = priceStay(
    { ...RATES, fees: [{ id: 'clean', unit: 'per_stay', amountCents: 250 }] },
    { ...stay, arrival: '2027-06-28', departure: '2027-07-05', extras: { car: 2, wood: 1 } },
  );
  if (!result.ok) throw new Error(result.error.code);
  const sum = result.quote.lines.reduce((total, line) => total + line.totalCents, 0);
  assertEquals(result.quote.totalCents, sum);
});

Deno.test('a missing price makes the stay unsellable; 0 is free', () => {
  const withoutChild = {
    ...RATES,
    prices: RATES.prices.filter((p) => !(p.seasonId === 'high' && p.itemId === 'child')),
  };
  assertEquals(
    priceStay(withoutChild, { ...stay, arrival: '2027-06-30', departure: '2027-07-02' }),
    {
      ok: false,
      error: { code: 'no_price', itemType: 'guest', itemId: 'child', seasonId: 'high' },
    },
  );
  // ...but only when the party needs that category
  assertEquals(
    priceStay(withoutChild, {
      pitchTypeId: 'tent',
      guests: { adult: 1 },
      arrival: '2027-07-01',
      departure: '2027-07-02',
    }).ok,
    true,
  );
  // an extra priced in the low season only
  assertEquals(
    priceStay(RATES, {
      ...stay,
      arrival: '2027-06-30',
      departure: '2027-07-02',
      extras: { power: 1 },
    }),
    {
      ok: false,
      error: { code: 'no_price', itemType: 'extra', itemId: 'power', seasonId: 'high' },
    },
  );
  const free = {
    ...RATES,
    prices: RATES.prices.map((p) => (p.itemId === 'child' ? { ...p, amountCents: 0 } : p)),
  };
  const result = priceStay(free, { ...stay, arrival: '2027-06-01', departure: '2027-06-02' });
  assertEquals(result.ok && result.quote.totalCents, 2600);
});

Deno.test('reports nights without a season, empty stays and bad extras', () => {
  assertEquals(priceStay(RATES, { ...stay, arrival: '2027-08-31', departure: '2027-09-02' }), {
    ok: false,
    error: { code: 'no_season', night: '2027-09-01' },
  });
  assertEquals(priceStay(RATES, { ...stay, arrival: '2027-07-01', departure: '2027-07-01' }), {
    ok: false,
    error: { code: 'no_nights' },
  });
  assertEquals(
    priceStay(RATES, {
      ...stay,
      arrival: '2027-07-01',
      departure: '2027-07-02',
      extras: { boat: 1 },
    }),
    { ok: false, error: { code: 'unknown_extra', extraId: 'boat' } },
  );
  assertEquals(
    priceStay(RATES, {
      ...stay,
      arrival: '2027-07-01',
      departure: '2027-07-02',
      extras: { car: 3 },
    }),
    { ok: false, error: { code: 'too_many', extraId: 'car' } },
  );
});

Deno.test('refuses amounts beyond safe integers', () => {
  const huge = {
    ...RATES,
    prices: RATES.prices.map((p) => ({ ...p, amountCents: Number.MAX_SAFE_INTEGER })),
  };
  assertThrows(
    () => priceStay(huge, { ...stay, arrival: '2027-07-01', departure: '2027-07-03' }),
    RangeError,
  );
});

Deno.test('offers extras priced for the whole stay', () => {
  const ids = (arrival: string, departure: string) =>
    offeredExtras(RATES, arrival, departure).map((e) => e.id);
  assertEquals(ids('2027-06-28', '2027-06-30'), ['car', 'wood', 'power']);
  assertEquals(ids('2027-06-30', '2027-07-02'), ['car', 'wood']);
  assertEquals(ids('2027-08-31', '2027-09-02'), []);
});

Deno.test('parses Postgres date ranges', () => {
  assertEquals(parseDateRange('[2027-07-01,2027-09-01)'), {
    start: '2027-07-01',
    end: '2027-09-01',
  });
  assertEquals(parseDateRange('(2027-07-01,2027-09-01]'), null);
  assertEquals(parseDateRange(null), null);
});
