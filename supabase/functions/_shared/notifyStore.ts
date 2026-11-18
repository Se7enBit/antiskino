/**
 * The notification queue as the notify function sees it (secret key only):
 * claim due pushes, report outcomes, drop devices Expo no longer knows.
 */
import { createClient, type SupabaseClient, z } from './deps.ts';
import type { Audience, Locale, PushBooking } from './pushMessages.ts';

export type ClaimedPush = {
  id: number;
  kind: string;
  audience: Audience;
  attempts: number;
  booking: PushBooking;
  recipients: { token: string; locale: Locale }[];
};

/** 'retry' leaves the push for a later run (until the fifth attempt). */
export type PushOutcome = 'sent' | 'skipped' | 'retry';

export interface NotifyStore {
  claim(limit: number): Promise<ClaimedPush[]>;
  finish(id: number, outcome: PushOutcome, error?: string): Promise<void>;
  forget(tokens: string[]): Promise<void>;
}

const claimedRow = z.object({
  id: z.number(),
  kind: z.string(),
  audience: z.enum(['guest', 'partner']),
  attempts: z.number(),
  booking: z.object({
    ref: z.string(),
    status: z.string(),
    arrival: z.string(),
    departure: z.string(),
    guest_name: z.string(),
    camping_name: z.string(),
    request_expires_at: z.string().nullable(),
    review_rating: z.number().nullable().optional(),
  }),
  recipients: z.array(z.object({ token: z.string(), locale: z.enum(['el', 'en']).catch('el') })),
});

export function notifyStoreFor(): NotifyStore {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return supabaseNotifyStore(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

export function supabaseNotifyStore(admin: SupabaseClient): NotifyStore {
  return {
    async claim(limit) {
      const { data, error } = await admin.rpc('claim_push_notifications', { p_limit: limit });
      if (error) throw new Error(error.message);
      return z
        .array(claimedRow)
        .parse(data ?? [])
        .map((row) => ({
          id: row.id,
          kind: row.kind,
          audience: row.audience,
          attempts: row.attempts,
          booking: {
            ref: row.booking.ref,
            status: row.booking.status,
            arrival: row.booking.arrival,
            departure: row.booking.departure,
            guestName: row.booking.guest_name,
            campingName: row.booking.camping_name,
            requestExpiresAt: row.booking.request_expires_at,
            reviewRating: row.booking.review_rating ?? null,
          },
          recipients: row.recipients,
        }));
    },

    async finish(id, outcome, error) {
      const result = await admin.rpc('finish_push_notification', {
        p_id: id,
        p_outcome: outcome,
        p_error: error ?? null,
      });
      if (result.error) throw new Error(result.error.message);
    },

    async forget(tokens) {
      if (tokens.length === 0) return;
      const { error } = await admin.rpc('forget_push_tokens', { p_tokens: tokens });
      if (error) throw new Error(error.message);
    },
  };
}
