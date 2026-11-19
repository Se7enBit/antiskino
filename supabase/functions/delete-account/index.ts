// POST /functions/v1/delete-account — deletes the signed-in user's account (Account tab, /delete-account).
import { accountsFor } from '../_shared/accounts.ts';
import { z } from '../_shared/deps.ts';
import { serveJson } from '../_shared/http.ts';
import { deleteAccount } from './handler.ts';

Deno.serve(
  serveJson(z.object({}), (_input, req) =>
    deleteAccount(req.headers.get('Authorization'), accountsFor()),
  ),
);
