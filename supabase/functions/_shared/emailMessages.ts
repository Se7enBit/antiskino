/**
 * Email texts (SPEC F10) in the recipient's language: a subject, plain text
 * and simple HTML built from the same lines. Every value is escaped in HTML.
 */
import type { Audience, Locale } from './pushMessages.ts';

export type EmailBooking = {
  ref: string;
  status: string;
  arrival: string;
  departure: string;
  nights: number;
  partySize: number;
  guestName: string;
  totalCents: number;
  paymentMode: string;
  cancellationPolicy: string;
  requestExpiresAt: string | null;
  cancelReason: string | null;
  reviewRating: number | null;
  /** jsonb {"el", "en"} */
  pitchTypeName: unknown;
  camping: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    lat: number | null;
    lng: number | null;
    checkInFrom: string | null;
    checkOutUntil: string | null;
  };
};

export type EmailLinks = {
  /** The guest's manage link, or null when its token isn't known (they sign in instead). */
  manage: string | null;
  /** The guest's booking after signing in. */
  signIn: string;
  /** The booking in the partner area. */
  partner: string;
  /** The app's start page, to search again. */
  site: string;
};

export type EmailContent = { subject: string; text: string; html: string };

type Draft = { subject: string; lines: string[]; button?: { label: string; url: string } };

const LOCALES: Record<Locale, string> = { el: 'el-GR', en: 'en-IE' };

/** "2027-07-10" → "10/07/2027" */
function date(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** A timestamp in Athens time: "01/07/2027 15:20". */
export function athensDateTime(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

function money(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALES[locale], { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
}

function localized(value: unknown, locale: Locale): string {
  if (typeof value !== 'object' || value === null) return '';
  const texts = value as Record<string, unknown>;
  for (const key of [locale, locale === 'el' ? 'en' : 'el']) {
    const text = texts[key];
    if (typeof text === 'string' && text.trim()) return text;
  }
  return '';
}

const time = (value: string | null) => (value ? value.slice(0, 5) : null);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function directionsUrl(lat: number | null, lng: number | null): string | null {
  return lat === null || lng === null
    ? null
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

const POLICY: Record<Locale, Record<string, string>> = {
  en: {
    flexible: 'Flexible cancellation: full refund up to the day before arrival.',
    moderate:
      'Moderate cancellation: full refund up to 7 days before arrival, 50% from 6 to 1 day before.',
    strict:
      'Strict cancellation: full refund up to 30 days before arrival, 50% from 29 to 7 days before, no refund later.',
  },
  el: {
    flexible: 'Ευέλικτη ακύρωση: πλήρης επιστροφή έως την προηγούμενη μέρα της άφιξης.',
    moderate:
      'Μέτρια ακύρωση: πλήρης επιστροφή έως 7 μέρες πριν την άφιξη, 50% από 6 έως 1 μέρα πριν.',
    strict:
      'Αυστηρή ακύρωση: πλήρης επιστροφή έως 30 μέρες πριν την άφιξη, 50% από 29 έως 7 μέρες πριν, καμία επιστροφή μετά.',
  },
};

/** The stay in a few lines, for guest emails. */
function stayLines(b: EmailBooking, locale: Locale): string[] {
  const el = locale === 'el';
  const pitch = localized(b.pitchTypeName, locale);
  const checkIn = time(b.camping.checkInFrom);
  const checkOut = time(b.camping.checkOutUntil);
  const contact = [b.camping.address, b.camping.phone, b.camping.email].filter(Boolean).join(' · ');
  return [
    `${el ? 'Ημερομηνίες' : 'Dates'}: ${date(b.arrival)} → ${date(b.departure)} (${el ? 'νύχτες' : 'nights'}: ${b.nights})`,
    ...(pitch ? [`${el ? 'Θέση' : 'Pitch'}: ${pitch}`] : []),
    `${el ? 'Άτομα' : 'People'}: ${b.partySize}`,
    b.paymentMode === 'on_site'
      ? el
        ? `Σύνολο: ${money(b.totalCents, locale)}, πληρωμή στο κάμπινγκ.`
        : `Total: ${money(b.totalCents, locale)}, paid at the camping.`
      : `${el ? 'Σύνολο' : 'Total'}: ${money(b.totalCents, locale)}`,
    ...(checkIn || checkOut
      ? [
          el
            ? [checkIn && `Check-in από ${checkIn}`, checkOut && `check-out έως ${checkOut}`]
                .filter(Boolean)
                .join(', ') + '.'
            : [checkIn && `Check-in from ${checkIn}`, checkOut && `check-out until ${checkOut}`]
                .filter(Boolean)
                .join(', ') + '.',
        ]
      : []),
    `${el ? 'Κωδικός' : 'Reference'}: ${b.ref}`,
    ...(contact ? [`${b.camping.name}: ${contact}`] : []),
  ];
}

/** The stay in one line, for the camping's team. */
function teamLine(b: EmailBooking, locale: Locale): string {
  const el = locale === 'el';
  return `${b.guestName} · ${date(b.arrival)} → ${date(b.departure)} · ${el ? 'άτομα' : 'people'}: ${b.partySize} · ${money(b.totalCents, locale)} · ${b.ref}`;
}

function guestLink(links: EmailLinks, locale: Locale, label: { el: string; en: string }) {
  return links.manage
    ? { label: label[locale], url: links.manage }
    : {
        label: locale === 'el' ? 'Συνδέσου για να δεις την κράτηση' : 'Sign in to see your booking',
        url: links.signIn,
      };
}

function draft(
  kind: string,
  audience: Audience,
  locale: Locale,
  b: EmailBooking,
  links: EmailLinks,
): Draft | null {
  const el = locale === 'el';
  const camping = b.camping.name;
  const hello = el ? `Γεια σου ${firstName(b.guestName)},` : `Hello ${firstName(b.guestName)},`;
  const dates = `${date(b.arrival)} → ${date(b.departure)}`;
  const searchAgain = {
    label: el ? 'Βρες άλλη διαμονή' : 'Find another stay',
    url: links.site,
  };
  const openBooking = { label: el ? 'Άνοιγμα κράτησης' : 'Open the booking', url: links.partner };
  const deadline = b.requestExpiresAt ? athensDateTime(b.requestExpiresAt) : '';
  const reason = b.cancelReason ? [`${el ? 'Αιτία' : 'Reason'}: ${b.cancelReason}`] : [];

  switch (`${kind}:${audience}`) {
    case 'booking_confirmed:guest':
      return {
        subject: el
          ? `Η κράτηση επιβεβαιώθηκε: ${camping} (${b.ref})`
          : `Booking confirmed: ${camping} (${b.ref})`,
        lines: [
          hello,
          el
            ? `Η διαμονή σου στο ${camping} είναι κλεισμένη.`
            : `Your stay at ${camping} is booked.`,
          ...stayLines(b, locale),
          POLICY[locale][b.cancellationPolicy] ?? '',
        ],
        button: guestLink(links, locale, {
          el: 'Δες ή ακύρωσε την κράτηση',
          en: 'View or cancel your booking',
        }),
      };
    case 'request_received:guest':
      return {
        subject: el
          ? `Το αίτημα στάλθηκε: ${camping} (${b.ref})`
          : `Request sent: ${camping} (${b.ref})`,
        lines: [
          hello,
          el
            ? `Το κάμπινγκ απαντά έως ${deadline}. Μέχρι τότε δεν έχει κλειστεί τίποτα· θα σου στείλουμε την απάντηση.`
            : `The camping answers by ${deadline}. Nothing is booked until then; we'll email you the answer.`,
          ...stayLines(b, locale),
        ],
        button: guestLink(links, locale, { el: 'Δες το αίτημα', en: 'View your request' }),
      };
    case 'request_declined:guest':
      return {
        subject: el
          ? `Το αίτημα δεν έγινε δεκτό: ${camping} (${b.ref})`
          : `Request not accepted: ${camping} (${b.ref})`,
        lines: [
          hello,
          el
            ? `Το ${camping} δεν μπόρεσε να δεχτεί το αίτημά σου για ${dates}. Δεν έχει κλειστεί τίποτα και δεν χρεώθηκες.`
            : `${camping} couldn't accept your request for ${dates}. Nothing is booked and nothing is charged.`,
        ],
        button: searchAgain,
      };
    case 'request_expired:guest':
      return {
        subject: el
          ? `Το αίτημα έληξε: ${camping} (${b.ref})`
          : `Request expired: ${camping} (${b.ref})`,
        lines: [
          hello,
          el
            ? `Το ${camping} δεν απάντησε εγκαίρως στο αίτημά σου για ${dates}. Δεν έχει κλειστεί τίποτα και δεν χρεώθηκες.`
            : `${camping} didn't answer your request for ${dates} in time. Nothing is booked and nothing is charged.`,
        ],
        button: searchAgain,
      };
    case 'booking_cancelled:guest':
      return {
        subject: el
          ? `Η κράτηση ακυρώθηκε: ${camping} (${b.ref})`
          : `Booking cancelled: ${camping} (${b.ref})`,
        lines: [
          hello,
          el
            ? `Η κράτησή σου στο ${camping} για ${dates} ακυρώθηκε.`
            : `Your booking at ${camping} for ${dates} is cancelled.`,
          ...reason,
          ...(b.paymentMode === 'on_site'
            ? [el ? 'Δεν χρεώθηκες τίποτα.' : 'Nothing is charged.']
            : []),
        ],
        button: searchAgain,
      };
    case 'arrival_reminder:guest': {
      const directions = directionsUrl(b.camping.lat, b.camping.lng);
      return {
        subject: el ? `Τα λέμε σε 2 μέρες στο ${camping}` : `See you in 2 days at ${camping}`,
        lines: [
          hello,
          el
            ? `Η διαμονή σου στο ${camping} ξεκινά σε 2 μέρες.`
            : `Your stay at ${camping} starts in 2 days.`,
          ...stayLines(b, locale),
          ...(links.manage
            ? [el ? `Η κράτησή σου: ${links.manage}` : `Your booking: ${links.manage}`]
            : []),
        ],
        button: directions
          ? { label: el ? 'Οδηγίες' : 'Directions', url: directions }
          : guestLink(links, locale, { el: 'Δες την κράτηση', en: 'View your booking' }),
      };
    }
    case 'review_invite:guest':
      return {
        subject: el ? `Πώς ήταν η διαμονή σου στο ${camping};` : `How was your stay at ${camping}?`,
        lines: [
          hello,
          el
            ? `Ευχαριστούμε που έμεινες στο ${camping}. Βαθμολόγησε τη διαμονή σου: παίρνει ένα λεπτό και βοηθά άλλους κατασκηνωτές.`
            : `Thank you for staying at ${camping}. Rate your stay: it takes a minute and helps other campers.`,
        ],
        button: guestLink(links, locale, { el: 'Γράψε αξιολόγηση', en: 'Write a review' }),
      };
    case 'booking_confirmed:partner':
      return {
        subject: el
          ? `Νέα κράτηση ${b.ref}: ${b.guestName}, ${dates}`
          : `New booking ${b.ref}: ${b.guestName}, ${dates}`,
        lines: [
          el ? `Νέα κράτηση στο ${camping}:` : `New booking at ${camping}:`,
          teamLine(b, locale),
        ],
        button: openBooking,
      };
    case 'request_received:partner':
      return {
        subject: el
          ? `Νέο αίτημα ${b.ref}: ${b.guestName}, ${dates}`
          : `New request ${b.ref}: ${b.guestName}, ${dates}`,
        lines: [
          el ? `Νέο αίτημα κράτησης στο ${camping}:` : `New booking request at ${camping}:`,
          teamLine(b, locale),
          el
            ? `Απάντησε έως ${deadline}, αλλιώς το αίτημα λήγει.`
            : `Answer by ${deadline}, or the request expires.`,
        ],
        button: openBooking,
      };
    case 'booking_cancelled:partner':
      return {
        subject: el
          ? `Ακύρωση κράτησης ${b.ref}: ${b.guestName}, ${dates}`
          : `Booking cancelled ${b.ref}: ${b.guestName}, ${dates}`,
        lines: [
          el ? `Ακυρώθηκε κράτηση στο ${camping}:` : `A booking at ${camping} was cancelled:`,
          teamLine(b, locale),
          ...reason,
        ],
        button: openBooking,
      };
    default:
      return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function render(d: Draft, locale: Locale): EmailContent {
  const lines = d.lines.filter((line) => line.trim() !== '');
  const footer =
    locale === 'el' ? 'Antiskino · κράτηση θέσης σε κάμπινγκ' : 'Antiskino · camping pitch booking';
  const text = [
    ...lines,
    ...(d.button ? ['', `${d.button.label}: ${d.button.url}`] : []),
    '',
    '—',
    footer,
  ].join('\n');
  const paragraphs = lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`);
  const button = d.button
    ? `<p style="margin:20px 0"><a href="${escapeHtml(d.button.url)}" style="background:#1f6f4a;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(d.button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1b"><div style="max-width:560px;margin:0 auto">${paragraphs.join('')}${button}<p style="margin:24px 0 0;font-size:13px;color:#6b6b6b">${escapeHtml(footer)}</p></div></body></html>`;
  return { subject: d.subject, text, html };
}

/** The email for one recipient, or null for a kind this audience doesn't get by email. */
export function emailFor(
  kind: string,
  audience: Audience,
  locale: Locale,
  booking: EmailBooking,
  links: EmailLinks,
): EmailContent | null {
  const d = draft(kind, audience, locale, booking, links);
  return d ? render(d, locale) : null;
}
