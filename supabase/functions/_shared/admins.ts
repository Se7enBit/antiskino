/** Is the caller a platform admin? (secret key only: reads the caller's profile) */
import { createClient, type SupabaseClient } from './deps.ts';

export interface Admins {
  isAdmin(authorization: string | null): Promise<boolean>;
}

export function adminsFor(): Admins {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return supabaseAdmins(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

export function supabaseAdmins(client: SupabaseClient): Admins {
  return {
    async isAdmin(authorization) {
      const jwt = authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!jwt) return false;
      // A public API key sent as a bearer token is not a user: getUser fails.
      const { data, error } = await client.auth.getUser(jwt);
      const userId = error ? null : data.user?.id;
      if (!userId) return false;
      const profile = await client
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', userId)
        .maybeSingle();
      return profile.data?.is_platform_admin === true;
    },
  };
}
