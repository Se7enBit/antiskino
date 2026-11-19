import { type EmailLinks, emailFor } from '../_shared/emailMessages.ts';
import type { ExpoMessage, ExpoTicket, PushSender } from '../_shared/expoPush.ts';
import { openToken } from '../_shared/linkToken.ts';
import type {
  ClaimedEmail,
  ClaimedPush,
  NotifyStore,
  PushOutcome,
} from '../_shared/notifyStore.ts';
import { pushText, pushUrl, stillRelevant } from '../_shared/pushMessages.ts';
import type { Mailer, OutgoingEmail } from '../_shared/resend.ts';
import { sha256Hex } from '../_shared/token.ts';

export type NotifyDeps = { store: NotifyStore; sender: PushSender; limit?: number };

export type NotifySummary = { claimed: number; sent: number; skipped: number; retried: number };

/** Expo's answer for a device that uninstalled the app or renewed its token. */
const GONE = 'DeviceNotRegistered';

/** The x-notify-secret header matches NOTIFY_SECRET (compared as digests, in constant time). */
export async function authorized(
  header: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !header) return false;
  const [a, b] = await Promise.all([sha256Hex(header), sha256Hex(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function messagesFor(push: ClaimedPush): ExpoMessage[] {
  const url = pushUrl(push.kind, push.audience, push.booking.ref);
  return push.recipients.flatMap((r) => {
    const text = pushText(push.kind, push.audience, r.locale, push.booking);
    return text
      ? [{ to: r.token, ...text, data: { url }, sound: 'default', channelId: 'default' }]
      : [];
  });
}

/** What one push's tickets mean: sent to at least one device, nobody left to reach, or retry. */
function outcomeOf(tickets: ExpoTicket[]): { outcome: PushOutcome; error?: string } {
  if (tickets.some((t) => t.status === 'ok')) return { outcome: 'sent' };
  const failure = tickets.find((t) => t.status === 'error' && t.details?.error !== GONE);
  if (!failure || failure.status !== 'error') return { outcome: 'skipped', error: 'no device' };
  return { outcome: 'retry', error: failure.details?.error ?? failure.message };
}

/**
 * One delivery run: claim the due pushes, send them in one go, record each
 * outcome. Logs counts only — never tokens, names or texts.
 */
export async function deliverPushes({
  store,
  sender,
  limit = 50,
}: NotifyDeps): Promise<NotifySummary> {
  const claimed = await store.claim(limit);
  const summary: NotifySummary = { claimed: claimed.length, sent: 0, skipped: 0, retried: 0 };
  const finish = async (id: number, outcome: PushOutcome, error?: string) => {
    await store.finish(id, outcome, error);
    if (outcome === 'sent') summary.sent++;
    else if (outcome === 'skipped') summary.skipped++;
    else summary.retried++;
  };

  const planned: { push: ClaimedPush; messages: ExpoMessage[] }[] = [];
  for (const push of claimed) {
    if (!stillRelevant(push.kind, push.booking)) {
      await finish(push.id, 'skipped', 'no longer relevant');
      continue;
    }
    const messages = messagesFor(push);
    if (messages.length === 0) await finish(push.id, 'skipped', 'no device');
    else planned.push({ push, messages });
  }
  if (planned.length === 0) return summary;

  let tickets: ExpoTicket[];
  try {
    tickets = await sender.send(planned.flatMap((p) => p.messages));
  } catch (e) {
    const error = e instanceof Error ? e.message : 'send failed';
    for (const { push } of planned) await finish(push.id, 'retry', error);
    return summary;
  }

  const gone: string[] = [];
  let next = 0;
  for (const { push, messages } of planned) {
    const own = tickets.slice(next, next + messages.length);
    next += messages.length;
    own.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === GONE) gone.push(messages[i]!.to);
    });
    const { outcome, error } = outcomeOf(own);
    await finish(push.id, outcome, error);
  }
  await store.forget(gone);
  return summary;
}

export type EmailDeps = {
  store: NotifyStore;
  mailer: Mailer;
  /** The app's address, e.g. https://se7enbit.github.io/antiskino */
  siteUrl: string;
  /** Opens the sealed manage tokens; null sends guests to sign in instead. */
  linkSecret: string | null;
  limit?: number;
};

/** The links an email may carry for one booking. */
export async function emailLinks(
  email: ClaimedEmail,
  siteUrl: string,
  linkSecret: string | null,
): Promise<EmailLinks> {
  const site = siteUrl.replace(/\/+$/, '');
  const ref = encodeURIComponent(email.booking.ref);
  const token =
    linkSecret && email.booking.manageTokenEnc
      ? await openToken(email.booking.manageTokenEnc, linkSecret)
      : null;
  return {
    manage: token ? `${site}/m?ref=${ref}&t=${encodeURIComponent(token)}` : null,
    signIn: `${site}/bookings/detail?ref=${ref}`,
    partner: `${site}/partner/bookings/detail?ref=${ref}`,
    site: `${site}/`,
  };
}

/**
 * One email run: claim the due emails, send them in one go with Resend, record
 * each outcome. Logs counts only — never addresses, names or texts.
 */
export async function deliverEmails({
  store,
  mailer,
  siteUrl,
  linkSecret,
  limit = 50,
}: EmailDeps): Promise<NotifySummary> {
  const claimed = await store.claimEmails(limit);
  const summary: NotifySummary = { claimed: claimed.length, sent: 0, skipped: 0, retried: 0 };
  const finish = async (id: number, outcome: PushOutcome, error?: string) => {
    await store.finish(id, outcome, error);
    if (outcome === 'sent') summary.sent++;
    else if (outcome === 'skipped') summary.skipped++;
    else summary.retried++;
  };

  const planned: { email: ClaimedEmail; messages: OutgoingEmail[] }[] = [];
  for (const email of claimed) {
    if (!stillRelevant(email.kind, email.booking)) {
      await finish(email.id, 'skipped', 'no longer relevant');
      continue;
    }
    const links = await emailLinks(email, siteUrl, linkSecret);
    const messages = email.recipients.flatMap((r) => {
      const content = emailFor(email.kind, email.audience, r.locale, email.booking, links);
      return content ? [{ to: r.email, ...content }] : [];
    });
    if (messages.length === 0) await finish(email.id, 'skipped', 'no recipient');
    else planned.push({ email, messages });
  }
  if (planned.length === 0) return summary;

  try {
    await mailer.send(planned.flatMap((p) => p.messages));
  } catch (e) {
    const error = e instanceof Error ? e.message : 'send failed';
    for (const { email } of planned) await finish(email.id, 'retry', error);
    return summary;
  }
  for (const { email } of planned) await finish(email.id, 'sent');
  return summary;
}
