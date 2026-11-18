import { useEffect } from 'react';

import { getPushToken } from '@/lib/push';
import { getSupabase } from '@/lib/supabase';

/** The device token registered in this app session, so sign-out can remove it. */
let registered: string | null = null;

/**
 * Registers this device for the signed-in user's pushes (SPEC F10). Only the
 * iOS and Android apps get a token, and only once the app has an EAS project.
 */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const device = await getPushToken();
      if (!device || cancelled) return;
      const { error } = await getSupabase().rpc('register_push_token', {
        p_token: device.token,
        p_platform: device.platform,
      });
      if (!error) registered = device.token;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/** Stops pushes to this device. Call before signing out, while the session still works. */
export async function unregisterPush(): Promise<void> {
  const token = registered;
  if (!token) return;
  registered = null;
  await getSupabase().rpc('unregister_push_token', { p_token: token });
}
