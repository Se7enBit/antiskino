/**
 * Push texts (SPEC F10) in the recipient's language. Guests see the camping;
 * the camping's team sees the guest's name. No contact details in pushes.
 */

export type Audience = 'guest' | 'partner';
export type Locale = 'el' | 'en';

export type PushBooking = {
  ref: string;
  status: string;
  arrival: string;
  departure: string;
  guestName: string;
  campingName: string;
  requestExpiresAt: string | null;
};

export type PushText = { title: string; body: string };

/** "2027-07-10" → "10/07" */
function day(date: string): string {
  const [, month, dayOfMonth] = date.split('-');
  return `${dayOfMonth}/${month}`;
}

/** A timestamp as Athens time: "15:20, 10/07". */
export function athensDeadline(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')}, ${part('day')}/${part('month')}`;
}

type Template = (b: PushBooking, stay: string, deadline: string) => PushText;

const TEMPLATES: Record<Locale, Record<string, Template>> = {
  en: {
    'booking_confirmed:guest': (b, stay) => ({
      title: 'Booking confirmed',
      body: `${b.campingName}, ${stay}. Reference ${b.ref}.`,
    }),
    'booking_confirmed:partner': (b, stay) => ({
      title: 'New booking',
      body: `${b.guestName}, ${stay} · ${b.ref}`,
    }),
    'request_received:partner': (b, stay, deadline) => ({
      title: 'New booking request',
      body: `${b.guestName}, ${stay}. Answer by ${deadline}.`,
    }),
    'request_expiring:partner': (b, stay, deadline) => ({
      title: 'Request expiring soon',
      body: `${b.guestName}, ${stay}. Answer by ${deadline}.`,
    }),
    'request_declined:guest': (b) => ({
      title: 'Request declined',
      body: `${b.campingName} couldn't accept your request ${b.ref}. Nothing is booked.`,
    }),
    'request_expired:guest': (b) => ({
      title: 'Request expired',
      body: `${b.campingName} didn't answer in time (${b.ref}). Nothing is booked.`,
    }),
    'booking_cancelled:guest': (b, stay) => ({
      title: 'Booking cancelled',
      body: `${b.campingName}, ${stay} · ${b.ref}`,
    }),
    'booking_cancelled:partner': (b, stay) => ({
      title: 'Booking cancelled',
      body: `${b.guestName}, ${stay} · ${b.ref}`,
    }),
  },
  el: {
    'booking_confirmed:guest': (b, stay) => ({
      title: 'Η κράτηση επιβεβαιώθηκε',
      body: `${b.campingName}, ${stay}. Κωδικός ${b.ref}.`,
    }),
    'booking_confirmed:partner': (b, stay) => ({
      title: 'Νέα κράτηση',
      body: `${b.guestName}, ${stay} · ${b.ref}`,
    }),
    'request_received:partner': (b, stay, deadline) => ({
      title: 'Νέο αίτημα κράτησης',
      body: `${b.guestName}, ${stay}. Απάντηση έως ${deadline}.`,
    }),
    'request_expiring:partner': (b, stay, deadline) => ({
      title: 'Το αίτημα λήγει σύντομα',
      body: `${b.guestName}, ${stay}. Απάντηση έως ${deadline}.`,
    }),
    'request_declined:guest': (b) => ({
      title: 'Το αίτημα απορρίφθηκε',
      body: `${b.campingName}: δεν μπόρεσε να δεχτεί το αίτημα ${b.ref}. Δεν έγινε κράτηση.`,
    }),
    'request_expired:guest': (b) => ({
      title: 'Το αίτημα έληξε',
      body: `${b.campingName}: δεν απάντησε εγκαίρως (${b.ref}). Δεν έγινε κράτηση.`,
    }),
    'booking_cancelled:guest': (b, stay) => ({
      title: 'Η κράτηση ακυρώθηκε',
      body: `${b.campingName}, ${stay} · ${b.ref}`,
    }),
    'booking_cancelled:partner': (b, stay) => ({
      title: 'Ακύρωση κράτησης',
      body: `${b.guestName}, ${stay} · ${b.ref}`,
    }),
  },
};

/** The push for one recipient, or null for a kind this audience doesn't get. */
export function pushText(
  kind: string,
  audience: Audience,
  locale: Locale,
  booking: PushBooking,
): PushText | null {
  const template = TEMPLATES[locale][`${kind}:${audience}`];
  if (!template) return null;
  const stay = `${day(booking.arrival)}–${day(booking.departure)}`;
  const deadline = booking.requestExpiresAt ? athensDeadline(booking.requestExpiresAt) : '';
  return template(booking, stay, deadline);
}

/** Request pushes are pointless once the request has been answered or has expired. */
export function stillRelevant(kind: string, status: string): boolean {
  if (kind === 'request_received' || kind === 'request_expiring') return status === 'requested';
  return true;
}

/** The app screen a tap opens: the guest's booking, or the booking in the partner area. */
export function pushUrl(audience: Audience, ref: string): string {
  const query = `?ref=${encodeURIComponent(ref)}`;
  return audience === 'guest' ? `/bookings/detail${query}` : `/partner/bookings/detail${query}`;
}
