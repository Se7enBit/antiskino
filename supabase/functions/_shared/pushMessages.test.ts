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
  reviewRating: null,
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
    ['arrival_reminder', 'guest'],
    ['review_invite', 'guest'],
    ['review_received', 'partner'],
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

Deno.test('drops pushes that no longer make sense', () => {
  const at = (status: string, reviewRating: number | null = null) => ({
    ...BOOKING,
    status,
    reviewRating,
  });
  assertEquals(stillRelevant('request_received', at('requested')), true);
  assertEquals(stillRelevant('request_expiring', at('confirmed')), false);
  assertEquals(stillRelevant('request_received', at('declined')), false);
  assertEquals(stillRelevant('arrival_reminder', at('confirmed')), true);
  assertEquals(stillRelevant('arrival_reminder', at('cancelled')), false);
  assertEquals(stillRelevant('review_invite', at('completed')), true);
  assertEquals(stillRelevant('review_invite', at('completed', 4)), false);
  assertEquals(stillRelevant('booking_cancelled', at('cancelled')), true);
});

Deno.test('invites reviews and tells the camping about them', () => {
  assertEquals(pushText('review_invite', 'guest', 'el', BOOKING), {
    title: 'Πώς ήταν η διαμονή σου;',
    body: 'Αξιολόγησε τη διαμονή σου στο Camping Thalassa. Παίρνει ένα λεπτό.',
  });
  assertEquals(pushText('review_received', 'partner', 'en', { ...BOOKING, reviewRating: 4 }), {
    title: 'New review',
    body: 'Maria P.: ★★★★ · 10/07–12/07',
  });
});

Deno.test('opens the booking in the right part of the app', () => {
  assertEquals(
    pushUrl('booking_confirmed', 'guest', 'ANT-7KQ2XM'),
    '/bookings/detail?ref=ANT-7KQ2XM',
  );
  assertEquals(
    pushUrl('request_received', 'partner', 'ANT-7KQ2XM'),
    '/partner/bookings/detail?ref=ANT-7KQ2XM',
  );
  assertEquals(pushUrl('review_received', 'partner', 'ANT-7KQ2XM'), '/partner/reviews');
});
