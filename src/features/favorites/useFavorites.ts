import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/api/auth';
import { mergeFavorites, useServerFavorites, useToggleServerFavorite } from '@/api/favorites';

import { useDeviceFavorites } from './favoritesStore';

const EMPTY: string[] = [];

/**
 * The user's favorites (SPEC F8): in the account when signed in, on the device
 * otherwise. `ready` is false while the account's list loads.
 */
export function useFavorites() {
  const { status, session } = useAuth();
  const userId = status === 'signedIn' ? session?.user.id : undefined;
  const device = useDeviceFavorites();
  const server = useServerFavorites(userId);
  const toggleServer = useToggleServerFavorite(userId);

  const ids = userId ? (server.data ?? EMPTY) : device.ids;
  return {
    ids,
    ready: userId ? server.data !== undefined : true,
    signedIn: Boolean(userId),
    isFavorite: (campingId: string) => ids.includes(campingId),
    toggle: (campingId: string) => {
      if (userId) toggleServer.mutate({ campingId, saved: ids.includes(campingId) });
      else device.toggle(campingId);
    },
  };
}

/** On sign-in, moves the device's favorites into the account (rendered once, in the root layout). */
export function useMergeDeviceFavorites() {
  const { status, session } = useAuth();
  const userId = status === 'signedIn' ? session?.user.id : undefined;
  const queryClient = useQueryClient();
  const deviceIds = useDeviceFavorites((s) => s.ids);
  const clear = useDeviceFavorites((s) => s.clear);

  useEffect(() => {
    if (!userId || deviceIds.length === 0) return;
    let cancelled = false;
    mergeFavorites(deviceIds)
      .then(() => {
        if (cancelled) return;
        clear();
        return queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] });
      })
      // Kept on the device: the next sign-in or app start tries again.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, deviceIds, clear, queryClient]);
}
