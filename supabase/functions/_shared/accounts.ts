/**
 * Deleting an account (secret key only): who is asking, the SQL that
 * anonymizes their bookings (prepare_account_deletion), then the login itself.
 */
import { createClient, type SupabaseClient, z } from './deps.ts';

export interface Accounts {
  /** The signed-in user behind an Authorization header, or null. */
  userId(authorization: string | null): Promise<string | null>;
  /** 'last_owner' when the user is a partner's only owner. */
  prepareDeletion(userId: string): Promise<'ok' | 'last_owner'>;
  deleteLogin(userId: string): Promise<void>;
}

export function accountsFor(): Accounts {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return supabaseAccounts(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

export function supabaseAccounts(admin: SupabaseClient): Accounts {
  return {
    async userId(authorization) {
      const jwt = authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!jwt) return null;
      // A public API key sent as a bearer token is not a user: getUser fails.
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },

    async prepareDeletion(userId) {
      const { data, error } = await admin.rpc('prepare_account_deletion', { p_user_id: userId });
      if (error) throw new Error(error.message);
      return z.enum(['ok', 'last_owner']).parse(data);
    },

    async deleteLogin(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}
