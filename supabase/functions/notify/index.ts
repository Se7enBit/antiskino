// POST /functions/v1/notify — sends the due pushes and emails (SPEC F10).
// Called every minute by pg_cron through pg_net (invoke_notify), with the
// shared secret in the x-notify-secret header. Not for the app.
import { expoSender } from '../_shared/expoPush.ts';
import { json } from '../_shared/http.ts';
import { linkSecret } from '../_shared/linkToken.ts';
import { notifyStoreFor } from '../_shared/notifyStore.ts';
import { resendMailer } from '../_shared/resend.ts';
import { authorized, deliverEmails, deliverPushes } from './handler.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(req.headers.get('x-notify-secret'), Deno.env.get('NOTIFY_SECRET'))))
    return json({ error: 'unauthorized' }, 401);
  try {
    const store = notifyStoreFor();
    const pushes = await deliverPushes({
      store,
      sender: expoSender(Deno.env.get('EXPO_ACCESS_TOKEN')),
    });
    // Emails wait until Resend is set up (RESEND_API_KEY, EMAIL_FROM, SITE_URL).
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('EMAIL_FROM');
    const siteUrl = Deno.env.get('SITE_URL');
    const emails =
      apiKey && from && siteUrl
        ? await deliverEmails({
            store,
            mailer: resendMailer(apiKey, from),
            siteUrl,
            linkSecret: linkSecret(),
          })
        : null;
    return json({ pushes, emails });
  } catch (e) {
    console.error('notify failed:', e instanceof Error ? e.message : 'unknown error');
    return json({ error: 'server_error' }, 500);
  }
});
