import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import type { Admins } from '../_shared/admins.ts';
import { HttpError } from '../_shared/http.ts';
import { MESSAGE_KINDS, messagePreviews } from '../_shared/messagePreviews.ts';
import { previewMessages } from './handler.ts';

const admins = (admin: boolean): Admins => ({ isAdmin: () => Promise.resolve(admin) });

Deno.test('only platform admins see the previews', async () => {
  await assertRejects(
    () => previewMessages('Bearer user', admins(false), 'https://example.org'),
    HttpError,
    'unauthorized',
  );
  const { previews } = await previewMessages('Bearer admin', admins(true), 'https://example.org');
  assertEquals(previews.length > 0, true);
});

Deno.test('every kind has a message, in both languages, for whom it goes to', () => {
  const previews = messagePreviews('https://example.org/antiskino/');
  for (const kind of MESSAGE_KINDS) {
    const own = previews.filter((p) => p.kind === kind);
    assertEquals(own.length > 0, true, `${kind} has no message`);
    for (const p of own) {
      assertEquals(
        own.some((o) => o.audience === p.audience && o.locale !== p.locale),
        true,
        `${kind} for ${p.audience} only in ${p.locale}`,
      );
    }
  }
});

Deno.test('emails carry the sample booking and links to the site', () => {
  const previews = messagePreviews('https://example.org/antiskino/');
  const confirmed = previews.find(
    (p) => p.kind === 'booking_confirmed' && p.audience === 'guest' && p.locale === 'en',
  );
  assertEquals(confirmed?.email?.subject, 'Booking confirmed: Camping Thalassa (ANT-7K3P9Q)');
  assertEquals(
    confirmed?.email?.text.includes('https://example.org/antiskino/m?ref=ANT-7K3P9Q&t=sample'),
    true,
  );
  assertEquals(confirmed?.push?.title !== undefined, true);
  // Team pushes only exist as pushes (no email for a request about to expire).
  const expiring = previews.find(
    (p) => p.kind === 'request_expiring' && p.audience === 'partner' && p.locale === 'el',
  );
  assertEquals(expiring?.email, null);
  assertEquals(typeof expiring?.push?.body, 'string');
});
