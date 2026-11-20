import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabase } from '@/lib/supabase';

/** Makes each subscription's channel name unique (see below). */
let subscriptions = 0;

/**
 * Refreshes the partner area when one of the camping's bookings changes
 * (Supabase Realtime). The event is only a signal to refetch: RLS decides who
 * receives it, and the screens read the rows through their usual queries.
 */
export function useCampingBookingsLive(campingId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!campingId) return;
    const supabase = getSupabase();
    // supabase-js hands back an existing channel of the same name until its
    // (async) removal completes, and a subscribed channel refuses new
    // callbacks: a remount would throw. The filter below does the selecting.
    subscriptions += 1;
    const channel = supabase
      .channel(`camping-bookings:${campingId}:${subscriptions}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `camping_id=eq.${campingId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['partner'] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campingId, queryClient]);
}
