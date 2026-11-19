import { assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';

import { athensDateTime, type EmailBooking, type EmailLinks, emailFor } from './emailMessages.ts';

const BOOKING: EmailBooking = {
  ref: 'ANT-7KQ2XM',
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  nights: 2,
  partySize: 3,
  guestName: 'Maria Papadopoulou',
  totalCents: 9050,
  paymentMode: 'on_site',
  cancellationPolicy: 'flexible',
  requestExpiresAt: '2027-07-01T12:20:00Z',
  cancelReason: null,
  reviewRating: null,
  pitchTypeName: { el: 'Θέση σκηνής', en: 'Tent pitch' },
  camping: {
    name: 'Camping Thalassa',
    address: 'Paralia, Pieria',
    phone: '+30 23510 00000',
    email: null,
    lat: 40.09,
    lng: 22.6,
    checkInFrom: '14:00:00',
    checkOutUntil: '12:00:00',
  },
};

const LINKS: EmailLinks = {
  manage: 'https://example.org/antiskino/m?ref=ANT-7KQ2XM&t=tok',
  signIn: 'https://example.org/antiskino/bookings/detail?ref=ANT-7KQ2XM',
  partner: 'https://example.org/antiskino/partner/bookings/detail?ref=ANT-7KQ2XM',
  site: 'https://example.org/antiskino/',
};

Deno.test('confirms a booking to the guest with the stay and the manage link', () => {
  const email = emailFor('booking_confirmed', 'guest', 'en', BOOKING, LINKS)!;
  assertEquals(email.subject, 'Booking confirmed: Camping Thalassa (ANT-7KQ2XM)');
  for (const line of [
    'Hello Maria,',
    'Dates: 10/07/2027 → 12/07/2027 (nights: 2)',
    'Pitch: Tent pitch',
    'Total: €90.50, paid at the camping.',
    'Check-in from 14:00, check-out until 12:00.',
    'Camping Thalassa: Paralia, Pieria · +30 23510 00000',
    'Flexible cancellation: full refund up to the day before arrival.',
    'View or cancel your booking: https://example.org/antiskino/m?ref=ANT-7KQ2XM&t=tok',
  ]) {
    assertStringIncludes(email.text, line);
  }
  assertStringIncludes(
    email.html,
    'href="https://example.org/antiskino/m?ref=ANT-7KQ2XM&amp;t=tok"',
  );
});

Deno.test('writes Greek to Greek guests', () => {
  const email = emailFor('booking_confirmed', 'guest', 'el', BOOKING, LINKS)!;
  assertEquals(email.subject, 'Η κράτηση επιβεβαιώθηκε: Camping Thalassa (ANT-7KQ2XM)');
  assertStringIncludes(email.text, 'Γεια σου Maria,');
  assertStringIncludes(email.text, 'Θέση: Θέση σκηνής');
  // Greek puts a no-break space before the euro sign.
  assertMatch(email.text, /Σύνολο: 90,50\s€, πληρωμή στο κάμπινγκ\./);
});

Deno.test('sends guests to sign in when the link token is not known', () => {
  const email = emailFor('booking_confirmed', 'guest', 'en', BOOKING, { ...LINKS, manage: null })!;
  assertStringIncludes(
    email.text,
    'Sign in to see your booking: https://example.org/antiskino/bookings/detail?ref=ANT-7KQ2XM',
  );
});

Deno.test('tells guests about requests and their answers', () => {
  const sent = emailFor(
    'request_received',
    'guest',
    'en',
    { ...BOOKING, status: 'requested' },
    LINKS,
  )!;
  assertStringIncludes(sent.text, 'The camping answers by 01/07/2027 15:20.');
  const declined = emailFor('request_declined', 'guest', 'el', BOOKING, LINKS)!;
  assertEquals(declined.subject, 'Το αίτημα δεν έγινε δεκτό: Camping Thalassa (ANT-7KQ2XM)');
  assertStringIncludes(declined.text, 'Βρες άλλη διαμονή: https://example.org/antiskino/');
  const cancelled = emailFor(
    'booking_cancelled',
    'guest',
    'en',
    { ...BOOKING, cancelReason: 'Flooded pitch' },
    LINKS,
  )!;
  assertStringIncludes(cancelled.text, 'Reason: Flooded pitch');
  assertStringIncludes(cancelled.text, 'Nothing is charged.');
});

Deno.test('reminds with directions and invites a review', () => {
  const reminder = emailFor('arrival_reminder', 'guest', 'en', BOOKING, LINKS)!;
  assertEquals(reminder.subject, 'See you in 2 days at Camping Thalassa');
  assertStringIncludes(
    reminder.text,
    'Directions: https://www.google.com/maps/dir/?api=1&destination=40.09,22.6',
  );
  const invite = emailFor('review_invite', 'guest', 'en', BOOKING, LINKS)!;
  assertStringIncludes(
    invite.text,
    'Write a review: https://example.org/antiskino/m?ref=ANT-7KQ2XM&t=tok',
  );
});

Deno.test('tells the camping about bookings, requests and cancellations', () => {
  const booked = emailFor('booking_confirmed', 'partner', 'en', BOOKING, LINKS)!;
  assertEquals(
    booked.subject,
    'New booking ANT-7KQ2XM: Maria Papadopoulou, 10/07/2027 → 12/07/2027',
  );
  assertStringIncludes(
    booked.text,
    'Open the booking: https://example.org/antiskino/partner/bookings/detail?ref=ANT-7KQ2XM',
  );
  const request = emailFor('request_received', 'partner', 'el', BOOKING, LINKS)!;
  assertStringIncludes(request.text, 'Απάντησε έως 01/07/2027 15:20, αλλιώς το αίτημα λήγει.');
  assertEquals(emailFor('booking_cancelled', 'partner', 'en', BOOKING, LINKS) !== null, true);
});

Deno.test('has no email for push-only kinds', () => {
  assertEquals(emailFor('request_expiring', 'partner', 'en', BOOKING, LINKS), null);
  assertEquals(emailFor('review_received', 'partner', 'en', BOOKING, LINKS), null);
  assertEquals(emailFor('request_declined', 'partner', 'en', BOOKING, LINKS), null);
});

Deno.test('escapes what guests typed', () => {
  const email = emailFor(
    'booking_cancelled',
    'partner',
    'en',
    { ...BOOKING, guestName: '<b>Eve</b>', cancelReason: 'a & b' },
    LINKS,
  )!;
  assertStringIncludes(email.html, '&lt;b&gt;Eve&lt;/b&gt;');
  assertStringIncludes(email.html, 'a &amp; b');
  assertEquals(email.html.includes('<b>Eve</b>'), false);
});

Deno.test('formats times in Athens', () => {
  assertEquals(athensDateTime('2027-01-15T22:05:00Z'), '16/01/2027 00:05');
});
