import { skipToken, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
} from '../../supabase/functions/_shared/api';
import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

import { invokeFunction } from './functions';

export type { SearchResponse, SearchResult };

/** Live campings (id, slug, name, region) for Home: single-camping mode and the region filter. */
export function useLiveCampings() {
  return useQuery({
    queryKey: ['public', 'campings', 'live'],
    // Without Supabase settings (tests, a misconfigured build) Home just shows the search.
    queryFn: hasSupabaseEnv() ? fetchLiveCampings : skipToken,
  });
}

async function fetchLiveCampings() {
  // Partner members can also read their draft campings: ask for live ones only.
  const { data, error } = await getSupabase()
    .from('campings')
    .select('id, slug, name, region')
    .eq('status', 'live')
    .order('name');
  if (error) throw error;
  return data;
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
        // Older deployments of the search function don't send it.
        rating: z.object({ average: z.number(), count: z.int() }).nullable().catch(null),
      }),
      fromTotalCents: z.int().nonnegative(),
      pitchTypes: z.array(z.object({ id: z.string(), totalCents: z.int().nonnegative() })),
    }),
  ),
});

/** Campings available for a stay, cheapest first (the `search` edge function). */
export function useSearch(request: SearchRequest | null) {
  return useQuery({
    queryKey: ['public', 'search', request],
    queryFn: request
      ? (): Promise<SearchResponse> => invokeFunction('search', request, searchResponseSchema)
      : skipToken,
    // Availability changes; don't show results older than a minute without refetching.
    staleTime: 60_000,
  });
}
