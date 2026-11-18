import { assertEquals } from 'jsr:@std/assert@1';

import {
  athensDeadline,
  type PushBooking,
  pushText,
  pushUrl,
  stillRelevant,
} from './pushMessages.ts';

const BOOKING: PushBooking = {
  ref: 'ANT-7KQ2XM',
  status: 'requested',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  guestName: 'Maria P.',
  campingName: 'Camping Thalassa',
  requestExpiresAt: '2027-07-01T12:20:00Z',
};

Deno.test('formats deadlines in Athens time (summer and winter)', () => {
  assertEquals(athensDeadline('2027-07-01T12:20:00Z'), '15:20, 01/07');
  assertEquals(athensDeadline('2027-01-15T22:05:00Z'), '00:05, 16/01');
});

Deno.test('tells the camping about a request and its deadline', () => {
  assertEquals(pushText('request_received', 'partner', 'en', BOOKING), {
    title: 'New booking request',
    body: 'Maria P., 10/07–12/07. Answer by 15:20, 01/07.',
  });
  assertEquals(pushText('request_expiring', 'partner', 'el', BOOKING), {
    title: 'Το αίτημα λήγει σύντομα',
    body: 'Maria P., 10/07–12/07. Απάντηση έως 15:20, 01/07.',
  });
});

Deno.test('tells guests about their booking, naming the camping', () => {
  assertEquals(pushText('booking_confirmed', 'guest', 'el', BOOKING), {
    title: 'Η κράτηση επιβεβαιώθηκε',
    body: 'Camping Thalassa, 10/07–12/07. Κωδικός ANT-7KQ2XM.',
  });
  assertEquals(pushText('request_declined', 'guest', 'en', BOOKING)?.title, 'Request declined');
  assertEquals(pushText('booking_cancelled', 'partner', 'en', BOOKING), {
    title: 'Booking cancelled',
    body: 'Maria P., 10/07–12/07 · ANT-7KQ2XM',
  });
});

Deno.test('has a text for every queued kind in both languages', () => {
  const pairs = [
    ['booking_confirmed', 'guest'],
    ['booking_confirmed', 'partner'],
    ['request_received', 'partner'],
    ['request_expiring', 'partner'],
    ['request_declined', 'guest'],
    ['request_expired', 'guest'],
    ['booking_cancelled', 'guest'],
    ['booking_cancelled', 'partner'],
  ] as const;
  for (const locale of ['el', 'en'] as const) {
    for (const [kind, audience] of pairs) {
      assertEquals(
        pushText(kind, audience, locale, BOOKING) !== null,
        true,
        `${kind}:${audience}:${locale}`,
      );
    }
  }
  assertEquals(pushText('request_received', 'guest', 'en', BOOKING), null);
});

Deno.test('drops request pushes once the request is answered', () => {
  assertEquals(stillRelevant('request_received', 'requested'), true);
  assertEquals(stillRelevant('request_expiring', 'confirmed'), false);
  assertEquals(stillRelevant('request_received', 'declined'), false);
  assertEquals(stillRelevant('booking_cancelled', 'cancelled'), true);
});

Deno.test('opens the booking in the right part of the app', () => {
  assertEquals(pushUrl('guest', 'ANT-7KQ2XM'), '/bookings/detail?ref=ANT-7KQ2XM');
  assertEquals(pushUrl('partner', 'ANT-7KQ2XM'), '/partner/bookings/detail?ref=ANT-7KQ2XM');
});
