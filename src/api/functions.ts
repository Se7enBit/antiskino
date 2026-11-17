import type { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

/** Calls an edge function and checks its answer at the boundary. */
export async function invokeFunction<T>(
  name: string,
  body: object,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<unknown>(name, { body });
  if (error) throw error;
  return schema.parse(data);
}
