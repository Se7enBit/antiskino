// JSON-over-POST plumbing shared by the edge functions.
import type { ErrorResponse } from './api.ts';
import { corsHeaders, type z } from './deps.ts';

/** An error with an HTTP status the client may see. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorResponse,
  ) {
    super(body.error);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * A handler for POST requests with a JSON body checked by `schema`. Answers
 * CORS preflights, 400 for bad input and 500 (without details) for failures.
 * Never logs request bodies.
 */
export function serveJson<T>(
  schema: z.ZodType<T, unknown>,
  run: (input: T, req: Request) => Promise<unknown>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST')
      return json({ error: 'method_not_allowed' } satisfies ErrorResponse, 405);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_input' } satisfies ErrorResponse, 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code }));
      return json({ error: 'invalid_input', issues } satisfies ErrorResponse, 400);
    }
    try {
      return json(await run(parsed.data, req));
    } catch (e) {
      if (e instanceof HttpError) return json(e.body, e.status);
      console.error('request failed:', e instanceof Error ? e.message : 'unknown error');
      return json({ error: 'server_error' } satisfies ErrorResponse, 500);
    }
  };
}
