/**
 * Sending through the Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/).
 * One ticket comes back per message, in the same order.
 */
import { z } from './deps.ts';

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { url: string };
  sound: 'default';
  channelId: 'default';
};

export type ExpoTicket =
  { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } };

export interface PushSender {
  send(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
}

const ticketSchema = z.union([
  z.object({ status: z.literal('ok') }),
  z.object({
    status: z.literal('error'),
    message: z.string(),
    details: z.object({ error: z.string().optional() }).optional(),
  }),
]);
const responseSchema = z.object({ data: z.array(ticketSchema) });

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

export function expoSender(accessToken?: string, fetchFn: typeof fetch = fetch): PushSender {
  return {
    async send(messages) {
      const tickets: ExpoTicket[] = [];
      for (let start = 0; start < messages.length; start += BATCH) {
        const batch = messages.slice(start, start + BATCH);
        const response = await fetchFn(ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(batch),
        });
        if (!response.ok) throw new Error(`Expo push failed with HTTP ${response.status}`);
        const { data } = responseSchema.parse(await response.json());
        if (data.length !== batch.length)
          throw new Error('Expo push returned the wrong number of tickets');
        tickets.push(...data);
      }
      return tickets;
    },
  };
}
