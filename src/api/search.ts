import { skipToken, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
} from '../../supabase/functions/_shared/api';
import { getSupabase } from '@/lib/supabase';

export type { SearchResponse, SearchResult };

/** Live campings (id, slug, name, region) for Home: single-camping mode and the region filter. */
export function useLiveCampings() {
  return useQuery({
    queryKey: ['public', 'campings', 'live'],
    queryFn: async () => {
      // Partner members can also read their draft campings: ask for live ones only.
      const { data, error } = await getSupabase()
        .from('campings')
        .select('id, slug, name, region')
        .eq('status', 'live')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

const searchResponseSchema = z.object({
  results: z.array(
    z.object({
      camping: z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        region: z.string().nullable(),
        lat: z.number().nullable(),
        lng: z.number().nullable(),
        shortDescr: z.unknown(),
        coverPhoto: z.string().nullable(),
      }),
      fromTotalCents: z.int().nonnegative(),
      pitchTypes: z.array(z.object({ id: z.string(), totalCents: z.int().nonnegative() })),
    }),
  ),
});

/** Calls an edge function and checks its answer. */
async function invoke<T>(name: string, body: object, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<unknown>(name, { body });
  if (error) throw error;
  return schema.parse(data);
}

/** Campings available for a stay, cheapest first (the `search` edge function). */
export function useSearch(request: SearchRequest | null) {
  return useQuery({
    queryKey: ['public', 'search', request],
    queryFn: request
      ? (): Promise<SearchResponse> => invoke('search', request, searchResponseSchema)
      : skipToken,
    // Availability changes; don't show results older than a minute without refetching.
    staleTime: 60_000,
  });
}
