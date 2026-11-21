import { z } from 'zod';

// zod compiles object parsers with `new Function` when it may. The website's
// Content-Security-Policy (scripts/csp.js) forbids eval, so trying would only
// log a violation on every page. Parse without compiling everywhere: same
// results, a little slower on large objects.
z.config({ jitless: true });
