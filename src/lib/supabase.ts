import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { z } from 'zod';

import type { Database } from '@/api/database.types';

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

// Web keeps the session in localStorage. Native persistence needs a storage
// library that SPEC §5 doesn't list yet; it arrives with sign-in (M4). Until
// then native sessions live in memory.
function browserStorage(): Storage | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createSupabaseClient(env: SupabaseEnv): AppSupabaseClient {
  const storage = browserStorage();
  return createClient<Database>(env.url, env.key, {
    auth: {
      storage,
      persistSession: storage !== undefined,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

let client: AppSupabaseClient | undefined;

/**
 * The app's Supabase client, created on first use so that screens and static
 * rendering work without credentials until something actually queries.
 * Only hooks in src/api/ call this; components never do.
 */
export function getSupabase(): AppSupabaseClient {
  // Expo inlines EXPO_PUBLIC_* only for literal `process.env.NAME` reads.
  client ??= createSupabaseClient(
    parseSupabaseEnv({
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
    }),
  );
  return client;
}
