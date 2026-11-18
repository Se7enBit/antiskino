import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabase } from '@/lib/supabase';

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
    const channel = supabase
      .channel(`camping-bookings:${campingId}`)
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
