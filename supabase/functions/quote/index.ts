// POST /functions/v1/quote — the price of one stay at one pitch type (SPEC F3).
import { catalogFor } from '../_shared/catalog.ts';
import { serveJson } from '../_shared/http.ts';
import { quoteRequestSchema } from '../_shared/stayInput.ts';
import { quote } from './handler.ts';

Deno.serve(serveJson(quoteRequestSchema, (input, req) => quote(input, catalogFor(req))));
