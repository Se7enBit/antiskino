import { skipToken, useQuery } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

async function fetchCampingPage(slug: string) {
  const supabase = getSupabase();
  const { data: camping, error } = await supabase
    .from('campings')
    // One literal string, so supabase-js infers the row type.
    .select(
      'id, slug, status, name, short_descr, descr, house_rules, region, address, lat, lng, amenities, check_in_from, check_out_until, confirmation_mode, request_expiry_hours, payment_mode, cancellation_policy, camping_photos(storage_path, sort), pitch_types(id, name, descr, included, accepts, max_people, size_m2, photos, active, sort), seasons(id, dates)',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!camping) return null;

  const seasonIds = camping.seasons.map((s) => s.id);
  const prices = seasonIds.length
    ? await supabase
        .from('prices')
        .select('season_id, item_id, amount_cents')
        .eq('item_type', 'pitch')
        .in('season_id', seasonIds)
    : { data: [], error: null };
  if (prices.error) throw prices.error;

  return {
    ...camping,
    photos: [...camping.camping_photos].sort((a, b) => a.sort - b.sort).map((p) => p.storage_path),
    // Partner members can read hidden pitch types too: the page shows active ones.
    pitchTypes: camping.pitch_types.filter((p) => p.active).sort((a, b) => a.sort - b.sort),
    pitchPrices: prices.data ?? [],
  };
}

/** A camping's public page by slug: texts, photos, active pitch types and pitch prices. */
export function useCampingPage(slug: string | undefined) {
  return useQuery({
    queryKey: ['public', 'camping', slug],
    queryFn: slug ? () => fetchCampingPage(slug) : skipToken,
  });
}

export type CampingPage = NonNullable<Awaited<ReturnType<typeof fetchCampingPage>>>;
