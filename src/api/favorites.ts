import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

const key = (userId: string | undefined) => ['me', 'favorites', userId] as const;

/** The signed-in user's saved campings (ids, newest first). */
export function useServerFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId),
    queryFn: userId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('favorites')
            .select('camping_id')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data.map((f) => f.camping_id);
        }
      : skipToken,
  });
}

/** Saves or removes a camping for the signed-in user, showing the change at once. */
export function useToggleServerFavorite(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campingId, saved }: { campingId: string; saved: boolean }) => {
      if (!userId) return;
      const supabase = getSupabase();
      const { error } = saved
        ? await supabase.from('favorites').delete().eq('camping_id', campingId)
        : await supabase.from('favorites').insert({ user_id: userId, camping_id: campingId });
      if (error) throw error;
    },
    onMutate: async ({ campingId, saved }) => {
      await queryClient.cancelQueries({ queryKey: key(userId) });
      const before = queryClient.getQueryData<string[]>(key(userId));
      queryClient.setQueryData<string[]>(key(userId), (ids = []) =>
        saved ? ids.filter((id) => id !== campingId) : [campingId, ...ids],
      );
      return { before };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(key(userId), context?.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(userId) }),
  });
}

/** Adds the device's favorites to the account (live campings only). */
export async function mergeFavorites(campingIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('merge_favorites', { p_camping_ids: campingIds });
  if (error) throw error;
}

/** The saved campings to list in the Favorites tab, in the given order (live ones only). */
export function useFavoriteCampings(ids: string[]) {
  return useQuery({
    queryKey: ['public', 'favorite-campings', ids],
    queryFn:
      ids.length > 0
        ? async () => {
            const { data, error } = await getSupabase()
              .from('campings')
              .select('id, slug, name, region, status, camping_photos(storage_path, sort)')
              .in('id', ids);
            if (error) throw error;
            const byId = new Map(data.map((c) => [c.id, c]));
            return ids.flatMap((id) => {
              const camping = byId.get(id);
              if (!camping || camping.status !== 'live') return [];
              const cover = [...camping.camping_photos].sort((a, b) => a.sort - b.sort)[0];
              return [{ ...camping, coverPhoto: cover?.storage_path ?? null }];
            });
          }
        : skipToken,
  });
}

export type FavoriteCamping = NonNullable<ReturnType<typeof useFavoriteCampings>['data']>[number];
