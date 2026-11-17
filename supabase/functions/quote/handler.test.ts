import { assertEquals } from 'jsr:@std/assert@1';

import { fakeCatalog, rates } from '../_shared/fakeCatalog.ts';
import { quote } from './handler.ts';

const REQUEST = {
  pitchTypeId: 'tent',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: 2,
  childAges: [],
  equipment: 'tent' as const,
  extras: {},
};

function catalog(sellable = true) {
  const card = rates(
    { tent: 1500 },
    {
      extras: [
        { id: 'car', unit: 'per_night', maxQty: 2 },
        { id: 'boat', unit: 'per_stay', maxQty: 1 },
      ],
      fees: [{ id: 'tax', unit: 'per_person_night', amountCents: 50 }],
    },
  );
  // the car is priced; the boat is not
  card.prices.push({ seasonId: 's', itemType: 'extra', itemId: 'car', amountCents: 300 });
  return fakeCatalog({
    campings: [],
    rates: { a: card },
    pitchTypes: { tent: 'a' },
    sellable: () => (sellable ? [{ campingId: 'a', pitchTypeId: 'tent' }] : []),
  });
}

Deno.test('prices a stay with extras and lists the extras on offer', async () => {
  const fake = catalog();
  const result = await quote({ ...REQUEST, extras: { car: 1 } }, fake);
  if (!result.available) throw new Error(result.reason);
  // per night: 1500 + 2 × 800 + car 300 + tax 2 × 50 = 3500
  assertEquals(result.quote.totalCents, 7000);
  assertEquals(result.offeredExtras, ['car']);
  assertEquals(fake.queries[0]?.campingId, 'a');
});

Deno.test('explains why a stay is not available', async () => {
  assertEquals(await quote({ ...REQUEST, pitchTypeId: 'nope' }, catalog()), {
    available: false,
    reason: 'not_found',
  });
  assertEquals(await quote(REQUEST, catalog(false)), { available: false, reason: 'unavailable' });
  assertEquals(await quote({ ...REQUEST, childAges: [1] }, catalog()), {
    available: false,
    reason: 'party',
  });
  assertEquals(await quote({ ...REQUEST, extras: { boat: 1 } }, catalog()), {
    available: false,
    reason: 'extras',
  });
  assertEquals(await quote({ ...REQUEST, extras: { car: 3 } }, catalog()), {
    available: false,
    reason: 'extras',
  });
  assertEquals(
    await quote({ ...REQUEST, arrival: '2027-07-31', departure: '2027-08-02' }, catalog()),
    {
      available: false,
      reason: 'no_price',
    },
  );
});
