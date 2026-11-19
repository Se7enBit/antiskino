/**
 * The notification queue as the notify function sees it (secret key only):
 * claim due pushes and emails, report outcomes, drop devices Expo no longer knows.
 */
import { createClient, type SupabaseClient, z } from './deps.ts';
import type { EmailBooking } from './emailMessages.ts';
import type { Audience, Locale, PushBooking } from './pushMessages.ts';

export type ClaimedPush = {
  id: number;
  kind: string;
  audience: Audience;
  attempts: number;
  booking: PushBooking;
  recipients: { token: string; locale: Locale }[];
};

export type ClaimedEmail = {
  id: number;
  kind: string;
  audience: Audience;
  attempts: number;
  booking: EmailBooking & { manageTokenEnc: string | null };
  recipients: { email: string; locale: Locale }[];
};

/** 'retry' leaves the push or email for a later run (until the fifth attempt). */
export type PushOutcome = 'sent' | 'skipped' | 'retry';

export interface NotifyStore {
  claim(limit: number): Promise<ClaimedPush[]>;
  claimEmails(limit: number): Promise<ClaimedEmail[]>;
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

const emailRow = z.object({
  id: z.number(),
  kind: z.string(),
  audience: z.enum(['guest', 'partner']),
  attempts: z.number(),
  booking: z.object({
    ref: z.string(),
    status: z.string(),
    arrival: z.string(),
    departure: z.string(),
    nights: z.number(),
    party_size: z.number(),
    guest_name: z.string(),
    total_cents: z.number(),
    payment_mode: z.string(),
    cancellation_policy: z.string(),
    request_expires_at: z.string().nullable(),
    cancel_reason: z.string().nullable(),
    manage_token_enc: z.string().nullable(),
    review_rating: z.number().nullable(),
    pitch_type_name: z.unknown(),
    camping: z.object({
      name: z.string(),
      address: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
      check_in_from: z.string().nullable(),
      check_out_until: z.string().nullable(),
    }),
  }),
  recipients: z.array(z.object({ email: z.string(), locale: z.enum(['el', 'en']).catch('el') })),
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

    async claimEmails(limit) {
      const { data, error } = await admin.rpc('claim_email_notifications', { p_limit: limit });
      if (error) throw new Error(error.message);
      return z
        .array(emailRow)
        .parse(data ?? [])
        .map(({ booking: b, ...row }) => ({
          ...row,
          booking: {
            ref: b.ref,
            status: b.status,
            arrival: b.arrival,
            departure: b.departure,
            nights: b.nights,
            partySize: b.party_size,
            guestName: b.guest_name,
            totalCents: b.total_cents,
            paymentMode: b.payment_mode,
            cancellationPolicy: b.cancellation_policy,
            requestExpiresAt: b.request_expires_at,
            cancelReason: b.cancel_reason,
            reviewRating: b.review_rating,
            pitchTypeName: b.pitch_type_name,
            manageTokenEnc: b.manage_token_enc,
            camping: {
              name: b.camping.name,
              address: b.camping.address,
              phone: b.camping.phone,
              email: b.camping.email,
              lat: b.camping.lat,
              lng: b.camping.lng,
              checkInFrom: b.camping.check_in_from,
              checkOutUntil: b.camping.check_out_until,
            },
          },
        }));
    },

    async finish(id, outcome, error) {
      const result = await admin.rpc('finish_notification', {
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
