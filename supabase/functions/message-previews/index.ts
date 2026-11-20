// POST /functions/v1/message-previews — every email and push with a sample
// booking, in both languages (admin area → Messages). Platform admins only.
import { adminsFor } from '../_shared/admins.ts';
import { z } from '../_shared/deps.ts';
import { serveJson } from '../_shared/http.ts';
import { previewMessages } from './handler.ts';

Deno.serve(
  serveJson(z.object({}), (_input, req) =>
    previewMessages(
      req.headers.get('Authorization'),
      adminsFor(),
      Deno.env.get('SITE_URL') ?? 'https://example.org',
    ),
  ),
);
