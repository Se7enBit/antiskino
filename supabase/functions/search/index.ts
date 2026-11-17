// POST /functions/v1/search — campings available for a stay, with prices (SPEC F1).
import { catalogFor } from '../_shared/catalog.ts';
import { serveJson } from '../_shared/http.ts';
import { searchRequestSchema } from '../_shared/stayInput.ts';
import { search } from './handler.ts';

Deno.serve(serveJson(searchRequestSchema, (input, req) => search(input, catalogFor(req))));
