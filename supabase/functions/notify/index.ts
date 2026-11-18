// POST /functions/v1/notify — sends the due pushes (SPEC F10). Called every
// minute by pg_cron through pg_net (invoke_notify), with the shared secret in
// the x-notify-secret header. Not for the app.
import { expoSender } from '../_shared/expoPush.ts';
import { json } from '../_shared/http.ts';
import { notifyStoreFor } from '../_shared/notifyStore.ts';
import { authorized, deliverPushes } from './handler.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(req.headers.get('x-notify-secret'), Deno.env.get('NOTIFY_SECRET'))))
    return json({ error: 'unauthorized' }, 401);
  try {
    const summary = await deliverPushes({
      store: notifyStoreFor(),
      sender: expoSender(Deno.env.get('EXPO_ACCESS_TOKEN')),
    });
    return json(summary);
  } catch (e) {
    console.error('notify failed:', e instanceof Error ? e.message : 'unknown error');
    return json({ error: 'server_error' }, 500);
  }
});
