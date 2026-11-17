import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import type { ReserveArgs } from '../_shared/booker.ts';
import { type Booker, Unavailable } from '../_shared/booker.ts';
import { fakeCatalog, rates } from '../_shared/fakeCatalog.ts';
import { sha256Hex } from '../_shared/token.ts';
import { createBooking } from './handler.ts';

const INPUT = {
  pitchTypeId: 'tent',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: 2,
  childAges: [6],
  equipment: 'tent' as const,
  extras: { car: 1 },
  guest: {
    name: 'Maria P.',
    email: 'maria@example.com',
    phone: '+30 690 123 4567',
    country: 'GR',
    locale: 'el' as const,
    arrivalEta: '15:30',
  },
  acceptTerms: true as const,
};

function catalog(sellable = true) {
  const card = rates({ tent: 1500 }, { extras: [{ id: 'car', unit: 'per_night', maxQty: 2 }] });
  card.prices.push({ seasonId: 's', itemType: 'extra', itemId: 'car', amountCents: 300 });
  card.names.extra = { car: { en: 'Car' } };
  return fakeCatalog({
    campings: [],
    rates: { a: card },
    pitchTypes: { tent: 'a' },
    sellable: () => (sellable ? [{ campingId: 'a', pitchTypeId: 'tent' }] : []),
  });
}

function booker(outcome: 'ok' | 'taken' = 'ok') {
  const calls: { reserve: ReserveArgs[]; userId: (string | null)[] } = { reserve: [], userId: [] };
  const fake: Booker = {
    userId: (authorization) => {
      calls.userId.push(authorization);
      return Promise.resolve(authorization === 'Bearer user-jwt' ? 'user-1' : null);
    },
    reserve: (args) => {
      calls.reserve.push(args);
      if (outcome === 'taken') return Promise.reject(new Unavailable('sold out'));
      return Promise.resolve({
        bookingId: 'b1',
        ref: 'ANT-7K3P9Q',
        status: 'confirmed',
        requestExpiresAt: null,
      });
    },
  };
  return { fake, calls };
}

Deno.test('prices the stay on the server and reserves it', async () => {
  const { fake, calls } = booker();
  const result = await createBooking(INPUT, {
    catalog: catalog(),
    booker: fake,
    authorization: null,
  });
  if (!result.booked) throw new Error(result.reason);
  // per night: 1500 + 2 adults × 800 + 1 child × 400 + car 300 = 3800; two nights
  assertEquals(result.totalCents, 7600);
  assertEquals(
    [result.ref, result.status, result.requestExpiresAt],
    ['ANT-7K3P9Q', 'confirmed', null],
  );
  assertMatch(result.manageToken, /^[A-Za-z0-9_-]{43}$/);

  const args = calls.reserve[0]!;
  assertEquals(args.manageTokenHash, await sha256Hex(result.manageToken));
  assertEquals(args.party, { adult: 2, child: 1 });
  assertEquals(args.extras, { car: 1 });
  assertEquals(args.totalCents, 7600);
  assertEquals(args.userId, null);
  assertEquals(args.guest, {
    name: 'Maria P.',
    email: 'maria@example.com',
    phone: '+30 690 123 4567',
    country: 'GR',
    locale: 'el',
    vehicle_plate: undefined,
    arrival_eta: '15:30',
    note: undefined,
  });
  // the snapshot keeps the names at booking time
  assertEquals(args.breakdown.names.pitch, { en: 'Pitch tent' });
  assertEquals(args.breakdown.names.extra, { car: { en: 'Car' } });
  assertEquals(args.breakdown.totalCents, 7600);
});

Deno.test('links the booking to a signed-in guest', async () => {
  const { fake, calls } = booker();
  await createBooking(INPUT, {
    catalog: catalog(),
    booker: fake,
    authorization: 'Bearer user-jwt',
  });
  assertEquals(calls.reserve[0]?.userId, 'user-1');
});

Deno.test('leaves out extras with no quantity', async () => {
  const { fake, calls } = booker();
  await createBooking(
    { ...INPUT, extras: { car: 0 } },
    { catalog: catalog(), booker: fake, authorization: null },
  );
  assertEquals(calls.reserve[0]?.extras, {});
});

Deno.test('does not reserve what cannot be priced', async () => {
  const { fake, calls } = booker();
  assertEquals(
    await createBooking(INPUT, { catalog: catalog(false), booker: fake, authorization: null }),
    {
      booked: false,
      reason: 'unavailable',
    },
  );
  assertEquals(calls.reserve.length, 0);
});

Deno.test('reports a stay taken meanwhile as unavailable', async () => {
  const { fake } = booker('taken');
  assertEquals(
    await createBooking(INPUT, { catalog: catalog(), booker: fake, authorization: null }),
    {
      booked: false,
      reason: 'unavailable',
    },
  );
});
