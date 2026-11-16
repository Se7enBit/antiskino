import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Database } from '@/api/database.types';

import { authStorage } from './authStorage';

export type AppSupabaseClient = SupabaseClient<Database>;

const supabaseEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  EXPO_PUBLIC_SUPABASE_KEY: z.string().trim().min(1),
});

export type SupabaseEnv = { url: string; key: string };

/**
 * Validates the public Supabase settings. The error names the missing variables
 * but never echoes their values.
 */
export function parseSupabaseEnv(raw: Record<string, unknown>): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse(raw);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(
      `Missing or invalid ${names.join(', ')}. Copy .env.example to .env and fill it in.`,
    );
  }
  return {
    url: result.data.EXPO_PUBLIC_SUPABASE_URL,
    key: result.data.EXPO_PUBLIC_SUPABASE_KEY,
  };
}

// Sessions persist in localStorage on web and AsyncStorage on native
// (authStorage.native.ts); static rendering has no storage and no session.
export function createSupabaseClient(env: SupabaseEnv): AppSupabaseClient {
  const storage = authStorage();
  return createClient<Database>(env.url, env.key, {
    auth: {
      storage,
      persistSession: storage !== undefined,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}

// Expo inlines EXPO_PUBLIC_* only for literal `process.env.NAME` reads.
function readEnv(): Record<string, unknown> {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  };
}

/** False in builds without Supabase settings (sign-in then shows a notice). */
export function hasSupabaseEnv(): boolean {
  return supabaseEnvSchema.safeParse(readEnv()).success;
}

let client: AppSupabaseClient | undefined;

/**
 * The app's Supabase client, created on first use so that screens and static
 * rendering work without credentials until something actually queries.
 * Only hooks in src/api/ call this; components never do.
 */
export function getSupabase(): AppSupabaseClient {
  client ??= createSupabaseClient(parseSupabaseEnv(readEnv()));
  return client;
}
