import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

/** What a pre-rendered camping page needs for its <head> (title, description, og:image, JSON-LD). */
export type StaticCamping = {
  slug: string;
  name: string;
  shortDescr: unknown;
  coverPhoto: string | null;
  address: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  rating: { average: number; count: number } | null;
};

let cache = new Map<string, StaticCamping>();

/**
 * Live campings at build time, for generateStaticParams. The static export
 * renders the pages in the same process, which then reads them with
 * staticCamping(). A build without Supabase settings, or a failed request,
 * pre-renders no camping pages rather than failing the deploy.
 */
export async function loadStaticCampings(): Promise<StaticCamping[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getSupabase();
  const [{ data, error }, ratings] = await Promise.all([
    supabase
      .from('campings')
      .select(
        'id, slug, name, short_descr, address, region, lat, lng, phone, camping_photos(storage_path, sort)',
      )
      .eq('status', 'live'),
    supabase.from('camping_ratings').select('camping_id, rating_avg, review_count'),
  ]);
  if (error) {
    console.warn(`Camping pages not pre-rendered: ${error.message}`);
    return [];
  }
  // Without ratings the pages are still built, just without stars for search engines.
  const ratingOf = new Map(
    (ratings.data ?? []).map((r) => [
      r.camping_id,
      r.rating_avg !== null && r.review_count !== null
        ? { average: r.rating_avg, count: r.review_count }
        : null,
    ]),
  );
  const campings = data.map((c) => ({
    slug: c.slug,
    name: c.name,
    shortDescr: c.short_descr,
    coverPhoto: [...c.camping_photos].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null,
    address: c.address,
    region: c.region,
    lat: c.lat,
    lng: c.lng,
    phone: c.phone,
    rating: ratingOf.get(c.id) ?? null,
  }));
  cache = new Map(campings.map((c) => [c.slug, c]));
  return campings;
}

/** A camping loaded by loadStaticCampings(), during the static export only. */
export function staticCamping(slug: string): StaticCamping | undefined {
  return cache.get(slug);
}
