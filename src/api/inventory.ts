import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AllotmentArgs, ClosingValues } from '@/domain/availability';
import type { IsoDate } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase';

const inventoryKey = ['partner', 'inventory'] as const;

/** Inventory nights of the given pitch types from firstNight to lastNight (both included). */
export function useInventory(
  pitchTypeIds: string[] | undefined,
  firstNight: IsoDate,
  lastNight: IsoDate,
) {
  return useQuery({
    queryKey: [...inventoryKey, pitchTypeIds, firstNight, lastNight],
    queryFn: pitchTypeIds
      ? async () => {
          if (pitchTypeIds.length === 0) return [];
          const { data, error } = await getSupabase()
            .from('inventory_nights')
            .select('pitch_type_id, night, allotment, booked, closed')
            .in('pitch_type_id', pitchTypeIds)
            .gte('night', firstNight)
            .lte('night', lastNight);
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

/** set_allotment(): owners and admins. Returns the number of nights set. */
export function useSetAllotment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: AllotmentArgs) => {
      const { data, error } = await getSupabase().rpc('set_allotment', args);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKey }),
  });
}

/**
 * set_closed() for each chosen pitch type (one call each): the whole team.
 * Returns the number of nights changed.
 */
export function useSetClosed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, closed }: { values: ClosingValues; closed: boolean }) => {
      let changed = 0;
      for (const pitchTypeId of values.pitchTypeIds) {
        const { data, error } = await getSupabase().rpc('set_closed', {
          p_pitch_type_id: pitchTypeId,
          p_first_night: values.firstNight,
          p_last_night: values.lastNight,
          p_closed: closed,
        });
        if (error) throw error;
        changed += data;
      }
      return changed;
    },
    // Also after a failure: earlier pitch types may have changed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: inventoryKey }),
  });
}
