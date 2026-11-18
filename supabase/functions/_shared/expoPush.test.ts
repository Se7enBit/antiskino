import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { type ExpoMessage, expoSender } from './expoPush.ts';

const message = (n: number): ExpoMessage => ({
  to: `ExponentPushToken[${n}]`,
  title: 'T',
  body: 'B',
  data: { url: '/x' },
  sound: 'default',
  channelId: 'default',
});

function fakeFetch(answer: (batch: unknown[]) => Response) {
  const calls: { headers: Headers; batch: unknown[] }[] = [];
  const fn = (_url: string | URL | Request, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body)) as unknown[];
    calls.push({ headers: new Headers(init?.headers), batch });
    return Promise.resolve(answer(batch));
  };
  return { fn: fn as typeof fetch, calls };
}

const okTickets = (batch: unknown[]) =>
  Response.json({ data: batch.map(() => ({ status: 'ok', id: 'x' })) });

Deno.test('sends in batches of 100 and returns one ticket per message', async () => {
  const { fn, calls } = fakeFetch(okTickets);
  const tickets = await expoSender(undefined, fn).send(
    Array.from({ length: 150 }, (_, i) => message(i)),
  );
  assertEquals(
    calls.map((c) => c.batch.length),
    [100, 50],
  );
  assertEquals(tickets.length, 150);
  assertEquals(calls[0]!.headers.get('Authorization'), null);
});

Deno.test('sends the access token when there is one', async () => {
  const { fn, calls } = fakeFetch(okTickets);
  await expoSender('expo-token', fn).send([message(1)]);
  assertEquals(calls[0]!.headers.get('Authorization'), 'Bearer expo-token');
});

Deno.test('passes ticket errors through', async () => {
  const { fn } = fakeFetch(() =>
    Response.json({
      data: [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }],
    }),
  );
  assertEquals(await expoSender(undefined, fn).send([message(1)]), [
    { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
  ]);
});

Deno.test('fails on HTTP errors and wrong answers', async () => {
  const down = fakeFetch(() => new Response('busy', { status: 503 }));
  await assertRejects(() => expoSender(undefined, down.fn).send([message(1)]), Error, 'HTTP 503');
  const short = fakeFetch(() => Response.json({ data: [] }));
  await assertRejects(() => expoSender(undefined, short.fn).send([message(1)]), Error, 'tickets');
});
