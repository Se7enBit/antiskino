import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PriceRow } from '@/domain/rates';
import { getSupabase } from '@/lib/supabase';

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Insert<T extends keyof Tables> = Omit<Tables[T]['Insert'], 'camping_id'>;

const ratesKey = (campingId: string) => ['partner', 'rates', campingId] as const;

/** Seasons, guest categories, extras and fees of a camping. */
export function useRates(campingId: string | undefined) {
  return useQuery({
    queryKey: ratesKey(campingId ?? ''),
    queryFn: campingId
      ? async () => {
          const supabase = getSupabase();
          const [seasons, guestCategories, extras, fees] = await Promise.all([
            supabase.from('seasons').select('*').eq('camping_id', campingId).order('dates'),
            supabase
              .from('guest_categories')
              .select('*')
              .eq('camping_id', campingId)
              .order('min_age', { ascending: false }),
            supabase
              .from('extras')
              .select('*')
              .eq('camping_id', campingId)
              .order('sort')
              .order('id'),
            supabase.from('fees').select('*').eq('camping_id', campingId).order('id'),
          ]);
          for (const result of [seasons, guestCategories, extras, fees])
            if (result.error) throw result.error;
          return {
            seasons: seasons.data ?? [],
            guestCategories: guestCategories.data ?? [],
            extras: extras.data ?? [],
            fees: fees.data ?? [],
          };
        }
      : skipToken,
  });
}

/** Rates edits can affect several partner queries (e.g. deleting a season drops its prices). */
function useRatesMutation<V>(run: (values: V) => PromiseLike<{ error: unknown }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: V) => {
      const { error } = await run(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner'] }),
  });
}

type Save<T extends keyof Tables> = { id?: string; values: Insert<T> };

export function useSaveSeason(campingId: string) {
  return useRatesMutation(({ id, values }: Save<'seasons'>) =>
    id
      ? getSupabase().from('seasons').update(values).eq('id', id).select('id').single()
      : getSupabase()
          .from('seasons')
          .insert({ ...values, camping_id: campingId })
          .select('id')
          .single(),
  );
}

export function useSaveGuestCategory(campingId: string) {
  return useRatesMutation(({ id, values }: Save<'guest_categories'>) =>
    id
      ? getSupabase().from('guest_categories').update(values).eq('id', id).select('id').single()
      : getSupabase()
          .from('guest_categories')
          .insert({ ...values, camping_id: campingId })
          .select('id')
          .single(),
  );
}

export function useSaveExtra(campingId: string) {
  return useRatesMutation(({ id, values }: Save<'extras'>) =>
    id
      ? getSupabase().from('extras').update(values).eq('id', id).select('id').single()
      : getSupabase()
          .from('extras')
          .insert({ ...values, camping_id: campingId })
          .select('id')
          .single(),
  );
}

export function useSaveFee(campingId: string) {
  return useRatesMutation(({ id, values }: Save<'fees'>) =>
    id
      ? getSupabase().from('fees').update(values).eq('id', id).select('id').single()
      : getSupabase()
          .from('fees')
          .insert({ ...values, camping_id: campingId })
          .select('id')
          .single(),
  );
}

type RatesTable = 'seasons' | 'guest_categories' | 'extras' | 'fees';

/** Deletes a season (with its prices), guest category, extra or fee. */
export function useDeleteRate(campingId: string, table: RatesTable) {
  return useRatesMutation((id: string) =>
    getSupabase().from(table).delete().eq('id', id).select('id').single(),
  );
}

export function useSeasonPrices(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'prices', seasonId],
    queryFn: seasonId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('prices')
            .select('item_type, item_id, amount_cents')
            .eq('season_id', seasonId);
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

/** Replaces the season's whole price grid (all or nothing). */
export function useSetSeasonPrices(campingId: string) {
  return useRatesMutation(({ seasonId, prices }: { seasonId: string; prices: PriceRow[] }) =>
    getSupabase().rpc('set_season_prices', { p_season_id: seasonId, p_prices: prices }),
  );
}
