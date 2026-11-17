/**
 * The secret-key side of create-booking: who is booking, and the atomic
 * reservation in SQL (reserve_and_create_booking). Only edge functions hold
 * the secret key.
 */
import type { BookingBreakdown, Equipment } from './api.ts';
import { createClient, type SupabaseClient, z } from './deps.ts';
import { HttpError } from './http.ts';

export type ReserveArgs = {
  pitchTypeId: string;
  arrival: string;
  departure: string;
  equipment: Equipment;
  party: Record<string, number>;
  extras: Record<string, number>;
  /** As stored: name, email, phone, country, locale, vehicle_plate, arrival_eta, note. */
  guest: Record<string, string | undefined>;
  userId: string | null;
  totalCents: number;
  breakdown: BookingBreakdown;
  manageTokenHash: string;
};

export type Reserved = {
  bookingId: string;
  ref: string;
  status: 'confirmed' | 'requested';
  requestExpiresAt: string | null;
};

/** The stay can't be booked any more (taken meanwhile, closed…): SQL error ANT01. */
export class Unavailable extends Error {}

export interface Booker {
  /** The signed-in user behind an Authorization header, or null for guests. */
  userId(authorization: string | null): Promise<string | null>;
  reserve(args: ReserveArgs): Promise<Reserved>;
}

const reservedRow = z.object({
  booking_id: z.string(),
  ref: z.string(),
  status: z.enum(['confirmed', 'requested']),
  request_expires_at: z.string().nullable(),
});

export function bookerFor(): Booker {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return supabaseBooker(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

export function supabaseBooker(admin: SupabaseClient): Booker {
  return {
    async userId(authorization) {
      const jwt = authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!jwt) return null;
      // A public API key sent as a bearer token is not a user: getUser fails.
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },

    async reserve(args) {
      const { data, error } = await admin.rpc('reserve_and_create_booking', {
        p_pitch_type_id: args.pitchTypeId,
        p_arrival: args.arrival,
        p_departure: args.departure,
        p_equipment: args.equipment,
        p_party: args.party,
        p_extras: args.extras,
        p_guest: args.guest,
        p_user_id: args.userId,
        p_total_cents: args.totalCents,
        p_price_breakdown: args.breakdown,
        p_manage_token_hash: args.manageTokenHash,
      });
      if (error?.code === 'ANT01') throw new Unavailable(error.message);
      // Bad party, extras or guest details that got past validation.
      if (error?.code === '22023' || error?.code === '23514')
        throw new HttpError(400, { error: 'invalid_input' });
      if (error) throw new Error(error.message);
      const row = z.array(reservedRow).length(1).parse(data)[0]!;
      return {
        bookingId: row.booking_id,
        ref: row.ref,
        status: row.status,
        requestExpiresAt: row.request_expires_at,
      };
    },
  };
}
