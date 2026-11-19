import { assertEquals } from 'jsr:@std/assert@1';

import type { ExpoMessage, ExpoTicket, PushSender } from '../_shared/expoPush.ts';
import { sealToken } from '../_shared/linkToken.ts';
import type {
  ClaimedEmail,
  ClaimedPush,
  NotifyStore,
  PushOutcome,
} from '../_shared/notifyStore.ts';
import type { Mailer, OutgoingEmail } from '../_shared/resend.ts';
import { authorized, deliverEmails, deliverPushes } from './handler.ts';

const booking = {
  ref: 'ANT-7KQ2XM',
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  guestName: 'Maria P.',
  campingName: 'Camping Thalassa',
  requestExpiresAt: null,
  reviewRating: null,
};

const push = (id: number, patch: Partial<ClaimedPush> = {}): ClaimedPush => ({
  id,
  kind: 'booking_confirmed',
  audience: 'partner',
  attempts: 1,
  booking,
  recipients: [
    { token: `T${id}a`, locale: 'en' },
    { token: `T${id}b`, locale: 'el' },
  ],
  ...patch,
});

function fakeStore(claimed: ClaimedPush[]) {
  const finished: { id: number; outcome: PushOutcome; error?: string }[] = [];
  const forgotten: string[][] = [];
  const store: NotifyStore = {
    claim: () => Promise.resolve(claimed),
    claimEmails: () => Promise.resolve([]),
    finish: (id, outcome, error) => {
      finished.push(error === undefined ? { id, outcome } : { id, outcome, error });
      return Promise.resolve();
    },
    forget: (tokens) => {
      forgotten.push(tokens);
      return Promise.resolve();
    },
  };
  return { store, finished, forgotten };
}

function fakeSender(answer: (m: ExpoMessage) => ExpoTicket | 'throw') {
  const sent: ExpoMessage[] = [];
  const sender: PushSender = {
    send(messages) {
      sent.push(...messages);
      const tickets = messages.map(answer);
      if (tickets.includes('throw'))
        return Promise.reject(new Error('Expo push failed with HTTP 503'));
      return Promise.resolve(tickets as ExpoTicket[]);
    },
  };
  return { sender, sent };
}

const gone: ExpoTicket = {
  status: 'error',
  message: 'x',
  details: { error: 'DeviceNotRegistered' },
};

Deno.test('sends each recipient a push in their language and records it', async () => {
  const { store, finished, forgotten } = fakeStore([push(1)]);
  const { sender, sent } = fakeSender(() => ({ status: 'ok' }));
  const summary = await deliverPushes({ store, sender });
  assertEquals(summary, { claimed: 1, sent: 1, skipped: 0, retried: 0 });
  assertEquals(
    sent.map((m) => [m.to, m.title, m.data.url]),
    [
      ['T1a', 'New booking', '/partner/bookings/detail?ref=ANT-7KQ2XM'],
      ['T1b', 'Νέα κράτηση', '/partner/bookings/detail?ref=ANT-7KQ2XM'],
    ],
  );
  assertEquals(finished, [{ id: 1, outcome: 'sent' }]);
  assertEquals(forgotten, [[]]);
});

Deno.test('skips pushes with no device or no longer relevant, without calling Expo', async () => {
  const { store, finished } = fakeStore([
    push(1, { recipients: [] }),
    push(2, { kind: 'request_received', booking: { ...booking, status: 'confirmed' } }),
  ]);
  const { sender, sent } = fakeSender(() => ({ status: 'ok' }));
  const summary = await deliverPushes({ store, sender });
  assertEquals(sent, []);
  assertEquals(summary, { claimed: 2, sent: 0, skipped: 2, retried: 0 });
  assertEquals(finished, [
    { id: 1, outcome: 'skipped', error: 'no device' },
    { id: 2, outcome: 'skipped', error: 'no longer relevant' },
  ]);
});

Deno.test('forgets unregistered devices; a push reaching no device is skipped', async () => {
  const { store, finished, forgotten } = fakeStore([push(1), push(2)]);
  // Push 1 reaches one of its two devices; push 2 reaches none.
  const { sender } = fakeSender((m) => (m.to === 'T1a' ? { status: 'ok' } : gone));
  await deliverPushes({ store, sender });
  assertEquals(finished, [
    { id: 1, outcome: 'sent' },
    { id: 2, outcome: 'skipped', error: 'no device' },
  ]);
  assertEquals(forgotten, [['T1b', 'T2a', 'T2b']]);
});

Deno.test('retries pushes when Expo fails', async () => {
  const other: ExpoTicket = {
    status: 'error',
    message: 'Rate exceeded',
    details: { error: 'MessageRateExceeded' },
  };
  const one = fakeStore([push(1, { recipients: [{ token: 'T1a', locale: 'en' }] })]);
  await deliverPushes({ store: one.store, sender: fakeSender(() => other).sender });
  assertEquals(one.finished, [{ id: 1, outcome: 'retry', error: 'MessageRateExceeded' }]);

  const all = fakeStore([push(1), push(2)]);
  const summary = await deliverPushes({
    store: all.store,
    sender: fakeSender(() => 'throw').sender,
  });
  assertEquals(summary.retried, 2);
  assertEquals(
    all.finished.map((f) => [f.id, f.outcome, f.error]),
    [
      [1, 'retry', 'Expo push failed with HTTP 503'],
      [2, 'retry', 'Expo push failed with HTTP 503'],
    ],
  );
});

Deno.test('accepts only the shared secret', async () => {
  assertEquals(await authorized('s3cret', 's3cret'), true);
  assertEquals(await authorized('s3cret!', 's3cret'), false);
  assertEquals(await authorized(null, 's3cret'), false);
  assertEquals(await authorized('s3cret', undefined), false);
  assertEquals(await authorized('', ''), false);
});

const emailBooking: ClaimedEmail['booking'] = {
  ref: 'ANT-7KQ2XM',
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  nights: 2,
  partySize: 2,
  guestName: 'Maria P.',
  totalCents: 5000,
  paymentMode: 'on_site',
  cancellationPolicy: 'flexible',
  requestExpiresAt: null,
  cancelReason: null,
  reviewRating: null,
  pitchTypeName: { en: 'Tent pitch' },
  manageTokenEnc: null,
  camping: {
    name: 'Camping Thalassa',
    address: null,
    phone: null,
    email: null,
    lat: null,
    lng: null,
    checkInFrom: null,
    checkOutUntil: null,
  },
};

const claimedEmail = (id: number, patch: Partial<ClaimedEmail> = {}): ClaimedEmail => ({
  id,
  kind: 'booking_confirmed',
  audience: 'guest',
  attempts: 1,
  booking: emailBooking,
  recipients: [{ email: 'maria@example.org', locale: 'en' }],
  ...patch,
});

function emailStore(claimed: ClaimedEmail[]) {
  const finished: { id: number; outcome: PushOutcome; error?: string }[] = [];
  const store: NotifyStore = {
    claim: () => Promise.resolve([]),
    claimEmails: () => Promise.resolve(claimed),
    finish: (id, outcome, error) => {
      finished.push(error === undefined ? { id, outcome } : { id, outcome, error });
      return Promise.resolve();
    },
    forget: () => Promise.resolve(),
  };
  return { store, finished };
}

function fakeMailer(fails = false) {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    send(emails) {
      sent.push(...emails);
      return fails ? Promise.reject(new Error('Resend HTTP 429')) : Promise.resolve();
    },
  };
  return { mailer, sent };
}

Deno.test('emails guests with their manage link and the team with the booking', async () => {
  const sealed = await sealToken('the-token', 'secret');
  const { store, finished } = emailStore([
    claimedEmail(1, { booking: { ...emailBooking, manageTokenEnc: sealed } }),
    claimedEmail(2, {
      audience: 'partner',
      recipients: [
        { email: 'owner@example.org', locale: 'en' },
        { email: 'staff@example.org', locale: 'el' },
      ],
    }),
  ]);
  const { mailer, sent } = fakeMailer();
  const summary = await deliverEmails({
    store,
    mailer,
    siteUrl: 'https://example.org/antiskino/',
    linkSecret: 'secret',
  });
  assertEquals(summary, { claimed: 2, sent: 2, skipped: 0, retried: 0 });
  assertEquals(
    sent.map((e) => [e.to, e.subject]),
    [
      ['maria@example.org', 'Booking confirmed: Camping Thalassa (ANT-7KQ2XM)'],
      ['owner@example.org', 'New booking ANT-7KQ2XM: Maria P., 10/07/2027 → 12/07/2027'],
      ['staff@example.org', 'Νέα κράτηση ANT-7KQ2XM: Maria P., 10/07/2027 → 12/07/2027'],
    ],
  );
  assertEquals(
    sent[0]!.text.includes('https://example.org/antiskino/m?ref=ANT-7KQ2XM&t=the-token'),
    true,
  );
  assertEquals(finished, [
    { id: 1, outcome: 'sent' },
    { id: 2, outcome: 'sent' },
  ]);
});

Deno.test('skips emails that no longer make sense or reach nobody', async () => {
  const { store, finished } = emailStore([
    claimedEmail(1, {
      kind: 'request_received',
      booking: { ...emailBooking, status: 'confirmed' },
    }),
    claimedEmail(2, { audience: 'partner', recipients: [] }),
  ]);
  const { mailer, sent } = fakeMailer();
  await deliverEmails({ store, mailer, siteUrl: 'https://example.org', linkSecret: null });
  assertEquals(sent, []);
  assertEquals(finished, [
    { id: 1, outcome: 'skipped', error: 'no longer relevant' },
    { id: 2, outcome: 'skipped', error: 'no recipient' },
  ]);
});

Deno.test('retries emails when Resend fails', async () => {
  const { store, finished } = emailStore([claimedEmail(1)]);
  const { mailer } = fakeMailer(true);
  const summary = await deliverEmails({
    store,
    mailer,
    siteUrl: 'https://example.org',
    linkSecret: null,
  });
  assertEquals(summary.retried, 1);
  assertEquals(finished, [{ id: 1, outcome: 'retry', error: 'Resend HTTP 429' }]);
});
