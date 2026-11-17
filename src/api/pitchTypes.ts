import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PitchTypeValues } from '@/domain/pitchTypes';
import { getSupabase } from '@/lib/supabase';

/** All pitch types of a camping, hidden ones included (members only). */
export function usePitchTypes(campingId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'pitch-types', campingId],
    queryFn: campingId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('pitch_types')
            .select('*')
            .eq('camping_id', campingId)
            .order('sort')
            .order('created_at');
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

/** Creates (no id) or updates a pitch type; returns its id. */
export function useSavePitchType(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
      sort,
    }: {
      id?: string;
      values: PitchTypeValues;
      sort?: number;
    }) => {
      const supabase = getSupabase();
      const { data, error } = id
        ? await supabase.from('pitch_types').update(values).eq('id', id).select('id').single()
        : await supabase
            .from('pitch_types')
            .insert({ ...values, camping_id: campingId, sort: sort ?? 0 })
            .select('id')
            .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['partner', 'pitch-types', campingId] }),
  });
}
