import type { ExpoMessage, ExpoTicket, PushSender } from '../_shared/expoPush.ts';
import type { ClaimedPush, NotifyStore, PushOutcome } from '../_shared/notifyStore.ts';
import { pushText, pushUrl, stillRelevant } from '../_shared/pushMessages.ts';
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
  const url = pushUrl(push.audience, push.booking.ref);
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
    if (!stillRelevant(push.kind, push.booking.status)) {
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
