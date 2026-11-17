import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

/** What a pre-rendered camping page needs for its <head> (title, description, og:image). */
export type StaticCamping = {
  slug: string;
  name: string;
  shortDescr: unknown;
  coverPhoto: string | null;
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
  const { data, error } = await getSupabase()
    .from('campings')
    .select('slug, name, short_descr, camping_photos(storage_path, sort)')
    .eq('status', 'live');
  if (error) {
    console.warn(`Camping pages not pre-rendered: ${error.message}`);
    return [];
  }
  const campings = data.map((c) => ({
    slug: c.slug,
    name: c.name,
    shortDescr: c.short_descr,
    coverPhoto: [...c.camping_photos].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null,
  }));
  cache = new Map(campings.map((c) => [c.slug, c]));
  return campings;
}

/** A camping loaded by loadStaticCampings(), during the static export only. */
export function staticCamping(slug: string): StaticCamping | undefined {
  return cache.get(slug);
}
