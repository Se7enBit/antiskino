import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { type OutgoingEmail, resendMailer } from './resend.ts';

const email = (n: number): OutgoingEmail => ({
  to: `guest${n}@example.org`,
  subject: 'S',
  text: 'T',
  html: '<p>T</p>',
});

function fakeFetch(answer: () => Response) {
  const calls: { headers: Headers; batch: { from: string; to: string[] }[] }[] = [];
  const fn = (_url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      headers: new Headers(init?.headers),
      batch: JSON.parse(String(init?.body)) as { from: string; to: string[] }[],
    });
    return Promise.resolve(answer());
  };
  return { fn: fn as typeof fetch, calls };
}

Deno.test('sends batches of 100 from the sender, with the API key', async () => {
  const { fn, calls } = fakeFetch(() => Response.json({ data: [] }));
  await resendMailer('re_key', 'Antiskino <bookings@example.org>', fn).send(
    Array.from({ length: 120 }, (_, i) => email(i)),
  );
  assertEquals(
    calls.map((c) => c.batch.length),
    [100, 20],
  );
  assertEquals(calls[0]!.headers.get('Authorization'), 'Bearer re_key');
  assertEquals(calls[0]!.batch[0], {
    from: 'Antiskino <bookings@example.org>',
    to: ['guest0@example.org'],
    subject: 'S',
    text: 'T',
    html: '<p>T</p>',
  } as unknown as { from: string; to: string[] });
});

Deno.test('fails with Resend’s reason', async () => {
  const { fn } = fakeFetch(() =>
    Response.json({ message: 'The example.org domain is not verified.' }, { status: 403 }),
  );
  await assertRejects(
    () => resendMailer('re_key', 'x@example.org', fn).send([email(1)]),
    Error,
    'Resend HTTP 403: The example.org domain is not verified.',
  );
});
