import { z } from 'zod';

const withCode = z.object({ code: z.string() });

/** The Postgres / PostgREST error code of a failed request, if any (e.g. "23505"). */
export function errorCode(error: unknown): string | undefined {
  const parsed = withCode.safeParse(error);
  return parsed.success ? parsed.data.code : undefined;
}

export const UNIQUE_VIOLATION = '23505';
