import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/api/auth';
import { usePushRegistration } from '@/api/push';
import { pushTarget } from '@/domain/push';
import { onPushTap } from '@/lib/push';

/** Registers the device while signed in, and opens the booking a tapped push is about. */
export function PushSetup() {
  const { status, session } = useAuth();
  usePushRegistration(status === 'signedIn' ? session?.user.id : undefined);
  useEffect(
    () =>
      onPushTap((data) => {
        const url = pushTarget(data);
        if (url) router.push(url as Href);
      }),
    [],
  );
  return null;
}
