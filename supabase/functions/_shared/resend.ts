/**
 * Sending through Resend (https://resend.com/docs/api-reference/emails/send-batch-emails):
 * up to 100 emails per request, all accepted or all refused.
 */
import { z } from './deps.ts';

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  send(emails: OutgoingEmail[]): Promise<void>;
}

const ENDPOINT = 'https://api.resend.com/emails/batch';
const BATCH = 100;
const errorBody = z.object({ message: z.string() }).partial();

export function resendMailer(apiKey: string, from: string, fetchFn: typeof fetch = fetch): Mailer {
  return {
    async send(emails) {
      for (let start = 0; start < emails.length; start += BATCH) {
        const batch = emails.slice(start, start + BATCH).map((e) => ({
          from,
          to: [e.to],
          subject: e.subject,
          text: e.text,
          html: e.html,
        }));
        const response = await fetchFn(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          // Resend's message says what is wrong (e.g. an unverified sending domain); no addresses in it.
          const body = errorBody.safeParse(await response.json().catch(() => ({})));
          const message = body.success && body.data.message ? `: ${body.data.message}` : '';
          throw new Error(`Resend HTTP ${response.status}${message}`);
        }
      }
    },
  };
}
