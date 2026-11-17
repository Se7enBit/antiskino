import { assertEquals } from 'jsr:@std/assert@1';

import { camping, fakeCatalog, rates } from '../_shared/fakeCatalog.ts';
import { search } from './handler.ts';

const STAY = {
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: 2,
  childAges: [6],
  equipment: 'tent' as const,
};

function catalog() {
  return fakeCatalog({
    campings: [camping('a'), camping('b', { region: 'Pelion' }), camping('c')],
    rates: {
      // a: tent 1500, caravan 2500; b: tent 1000; c: no price for its tent
      a: rates({ a_tent: 1500, a_van: 2500 }),
      b: rates({ b_tent: 1000 }),
      c: rates({}),
    },
    pitchTypes: {},
    sellable: () => [
      { campingId: 'a', pitchTypeId: 'a_tent' },
      { campingId: 'a', pitchTypeId: 'a_van' },
      { campingId: 'b', pitchTypeId: 'b_tent' },
      { campingId: 'c', pitchTypeId: 'c_tent' },
    ],
  });
}

Deno.test('lists priced campings cheapest first with their sellable pitch types', async () => {
  const fake = catalog();
  const { results } = await search(STAY, fake);
  // per night: pitch + 2 × 800 + 400; two nights
  assertEquals(
    results.map((r) => [r.camping.id, r.fromTotalCents, r.pitchTypes]),
    [
      ['b', 6000, [{ id: 'b_tent', totalCents: 6000 }]],
      [
        'a',
        7000,
        [
          { id: 'a_tent', totalCents: 7000 },
          { id: 'a_van', totalCents: 9000 },
        ],
      ],
    ],
  );
  assertEquals(fake.queries, [
    {
      arrival: '2027-07-10',
      departure: '2027-07-12',
      equipment: 'tent',
      partySize: 3,
      campingId: undefined,
    },
  ]);
});

Deno.test('filters by region and passes the camping filter on', async () => {
  const fake = catalog();
  const byRegion = await search({ ...STAY, region: 'Pelion' }, fake);
  assertEquals(
    byRegion.results.map((r) => r.camping.id),
    ['b'],
  );
  await search({ ...STAY, campingId: 'a' }, fake);
  assertEquals(fake.queries.at(-1)?.campingId, 'a');
});

Deno.test('leaves out campings that cannot price the party', async () => {
  // a 2-year-old fits neither adults 12+ nor children 4–11
  const { results } = await search({ ...STAY, childAges: [2] }, catalog());
  assertEquals(results, []);
});

Deno.test('returns nothing when nothing is sellable', async () => {
  const fake = fakeCatalog({ campings: [], rates: {}, pitchTypes: {}, sellable: () => [] });
  assertEquals(await search(STAY, fake), { results: [] });
});
