/**
 * Every email and push (SPEC F10) for a sample booking, in both languages,
 * for the admin's Messages page. Uses the real texts, so what admins read is
 * what guests and teams get.
 */
import type { MessagePreview } from './api.ts';
import { type EmailBooking, emailFor } from './emailMessages.ts';
import { type Audience, type Locale, pushText } from './pushMessages.ts';

/** In the order a booking meets them. */
export const MESSAGE_KINDS = [
  'booking_confirmed',
  'request_received',
  'request_expiring',
  'request_declined',
  'request_expired',
  'booking_cancelled',
  'arrival_reminder',
  'review_invite',
  'review_received',
] as const;

const AUDIENCES: Audience[] = ['guest', 'partner'];
const LOCALES: Locale[] = ['el', 'en'];

/** The sample booking, in the state each message is sent in. */
function sampleBooking(kind: string): EmailBooking {
  const base: EmailBooking = {
    ref: 'ANT-7K3P9Q',
    status: 'confirmed',
    arrival: '2027-07-10',
    departure: '2027-07-13',
    nights: 3,
    partySize: 3,
    guestName: 'Μαρία Παπαδοπούλου',
    totalCents: 8450,
    paymentMode: 'on_site',
    cancellationPolicy: 'moderate',
    requestExpiresAt: null,
    cancelReason: null,
    reviewRating: null,
    pitchTypeName: { el: 'Θέση σκηνής', en: 'Tent pitch' },
    camping: {
      name: 'Camping Thalassa',
      address: 'Σάρτη, Σιθωνία, 630 72 Χαλκιδική',
      phone: '+30 2375 000000',
      email: 'info@example.org',
      lat: 40.0915,
      lng: 23.98,
      checkInFrom: '14:00',
      checkOutUntil: '12:00',
    },
  };
  switch (kind) {
    case 'request_received':
    case 'request_expiring':
      return { ...base, status: 'requested', requestExpiresAt: '2027-06-20T15:30:00Z' };
    case 'request_declined':
      return { ...base, status: 'declined' };
    case 'request_expired':
      return { ...base, status: 'expired' };
    case 'booking_cancelled':
      return { ...base, status: 'cancelled', cancelReason: 'Flooding after a storm' };
    case 'review_invite':
      return { ...base, status: 'completed' };
    case 'review_received':
      return { ...base, status: 'completed', reviewRating: 5 };
    default:
      return base;
  }
}

/** Every message that exists, for each audience and language. */
export function messagePreviews(siteUrl: string): MessagePreview[] {
  const site = siteUrl.replace(/\/+$/, '');
  const links = {
    manage: `${site}/m?ref=ANT-7K3P9Q&t=sample`,
    signIn: `${site}/bookings/detail?ref=ANT-7K3P9Q`,
    partner: `${site}/partner/bookings/detail?ref=ANT-7K3P9Q`,
    site: `${site}/`,
  };
  return MESSAGE_KINDS.flatMap((kind) => {
    const booking = sampleBooking(kind);
    return AUDIENCES.flatMap((audience) =>
      LOCALES.flatMap((locale): MessagePreview[] => {
        const email = emailFor(kind, audience, locale, booking, links);
        const push = pushText(kind, audience, locale, {
          ...booking,
          campingName: booking.camping.name,
        });
        return email || push ? [{ kind, audience, locale, email, push }] : [];
      }),
    );
  });
}
