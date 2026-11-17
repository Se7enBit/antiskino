// POST /functions/v1/create-booking — books one stay (SPEC F3). No sign-in needed.
import { bookerFor } from '../_shared/booker.ts';
import { catalogFor } from '../_shared/catalog.ts';
import { serveJson } from '../_shared/http.ts';
import { createBookingRequestSchema } from '../_shared/stayInput.ts';
import { createBooking } from './handler.ts';

Deno.serve(
  serveJson(createBookingRequestSchema, (input, req) =>
    createBooking(input, {
      catalog: catalogFor(req),
      booker: bookerFor(),
      authorization: req.headers.get('Authorization'),
    }),
  ),
);
