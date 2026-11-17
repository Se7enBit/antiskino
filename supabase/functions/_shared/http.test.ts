import { assertEquals } from 'jsr:@std/assert@1';

import { HttpError, serveJson } from './http.ts';
import { searchRequestSchema } from './stayInput.ts';

const STAY = { arrival: '2027-07-10', departure: '2027-07-12', adults: 2, equipment: 'tent' };

const handler = serveJson(searchRequestSchema, (input) => {
  if (input.region === 'locked') throw new HttpError(401, { error: 'unauthorized' });
  if (input.region === 'boom') throw new Error('database is down');
  return Promise.resolve({ echo: input });
});

const post = (body: unknown) =>
  handler(
    new Request('http://x', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

Deno.test('answers CORS preflights and refuses other methods', async () => {
  const preflight = await handler(new Request('http://x', { method: 'OPTIONS' }));
  assertEquals(preflight.status, 200);
  assertEquals(preflight.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals((await handler(new Request('http://x'))).status, 405);
});

Deno.test('validates the body and fills defaults', async () => {
  const ok = await post(STAY);
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).echo.childAges, []);

  assertEquals((await post('not json')).status, 400);
  const bad = await post({ ...STAY, departure: '2027-07-10', childAges: [18] });
  assertEquals(bad.status, 400);
  assertEquals((await bad.json()).issues.map((i: { path: string }) => i.path).sort(), [
    'childAges.0',
    'departure',
  ]);
  const impossible = await post({ ...STAY, arrival: '2027-02-30' });
  assertEquals(
    [impossible.status, (await impossible.json()).issues],
    [400, [{ path: 'arrival', code: 'custom' }]],
  );
  const tooLong = await post({ ...STAY, departure: '2027-08-10' });
  assertEquals((await tooLong.json()).issues, [{ path: 'departure', code: 'custom' }]);
});

Deno.test('maps failures to status codes without details', async () => {
  const locked = await post({ ...STAY, region: 'locked' });
  assertEquals([locked.status, await locked.json()], [401, { error: 'unauthorized' }]);
  const originalError = console.error;
  console.error = () => {};
  try {
    const failed = await post({ ...STAY, region: 'boom' });
    assertEquals([failed.status, await failed.json()], [500, { error: 'server_error' }]);
  } finally {
    console.error = originalError;
  }
});

Deno.test('checks booking requests', async () => {
  const { createBookingRequestSchema } = await import('./stayInput.ts');
  const booking = {
    ...STAY,
    pitchTypeId: '0b3f6a3c-5a8e-4c79-9f43-2b7b3a2c1d10',
    guest: {
      name: ' Maria ',
      email: 'maria@example.com',
      phone: ' +30  690 123 4567 ',
      country: 'GR',
      locale: 'el',
    },
    acceptTerms: true,
  };
  const ok = createBookingRequestSchema.safeParse(booking);
  assertEquals(ok.success && [ok.data.guest.name, ok.data.guest.phone, ok.data.extras], [
    'Maria',
    '+30 690 123 4567',
    {},
  ]);
  const paths = (patch: Record<string, unknown>) => {
    const result = createBookingRequestSchema.safeParse({ ...booking, ...patch });
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
  };
  assertEquals(paths({ acceptTerms: false }), ['acceptTerms']);
  assertEquals(paths({ guest: { ...booking.guest, phone: '6901234567' } }), ['guest.phone']);
  assertEquals(paths({ guest: { ...booking.guest, country: 'Greece' } }), ['guest.country']);
  assertEquals(paths({ guest: { ...booking.guest, email: 'nope' } }), ['guest.email']);
  assertEquals(paths({ guest: { ...booking.guest, arrivalEta: '25:00' } }), ['guest.arrivalEta']);
});
