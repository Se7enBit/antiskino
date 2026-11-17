/**
 * What the search and quote functions read from the database.
 *
 * The Supabase implementation uses the caller's public API key (the `apikey`
 * header the app sends), not the secret key: reads go through RLS like any
 * visitor's, so only live campings and active pitch types and extras are seen.
 * Availability comes from sellable_pitch_types(), which anon may call.
 */
import type { Equipment, SearchCamping } from './api.ts';
import { createClient, type SupabaseClient, z } from './deps.ts';
import { HttpError } from './http.ts';
import type { AgeCategory } from './party.ts';
import { parseDateRange, type RateCard } from './pricing.ts';

/** Display names (jsonb {"el", "en"}) of a camping's guest categories, extras and fees. */
export type ItemNames = {
  guest: Record<string, unknown>;
  extra: Record<string, unknown>;
  fee: Record<string, unknown>;
};

/** The rate card of one camping plus its guest categories and item names. */
export type CampingRates = RateCard & { categories: AgeCategory[]; names: ItemNames };

export type SellableQuery = {
  arrival: string;
  departure: string;
  equipment: Equipment;
  partySize: number;
  campingId?: string;
};

export interface Catalog {
  sellable(query: SellableQuery): Promise<{ campingId: string; pitchTypeId: string }[]>;
  campings(ids: string[]): Promise<SearchCamping[]>;
  rates(campingIds: string[]): Promise<Map<string, CampingRates>>;
  /** An active pitch type's camping and name, or null. */
  pitchType(pitchTypeId: string): Promise<{ campingId: string; name: unknown } | null>;
}

/** A catalog reading with the API key of the request. */
export function catalogFor(req: Request): Catalog {
  const url = Deno.env.get('SUPABASE_URL');
  const apiKey = req.headers.get('apikey');
  if (!url || !apiKey) throw new HttpError(401, { error: 'unauthorized' });
  return supabaseCatalog(
    createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

// Row shapes, checked at the boundary.
const sellableRow = z.object({ camping_id: z.string(), pitch_type_id: z.string() });
const campingRow = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  short_descr: z.unknown(),
  camping_photos: z.array(z.object({ storage_path: z.string(), sort: z.number() })),
});
const seasonRow = z.object({ id: z.string(), camping_id: z.string(), dates: z.string() });
const categoryRow = z.object({
  id: z.string(),
  camping_id: z.string(),
  name: z.unknown(),
  min_age: z.int(),
  max_age: z.int().nullable(),
});
const extraRow = z.object({
  id: z.string(),
  camping_id: z.string(),
  name: z.unknown(),
  unit: z.enum(['per_night', 'per_stay']),
  max_qty: z.int(),
});
const feeRow = z.object({
  id: z.string(),
  camping_id: z.string(),
  name: z.unknown(),
  unit: z.enum(['per_person_night', 'per_pitch_night', 'per_stay']),
  amount_cents: z.int(),
});
const priceRow = z.object({
  season_id: z.string(),
  item_type: z.enum(['pitch', 'guest', 'extra']),
  item_id: z.string(),
  amount_cents: z.int(),
});

type Result = { data: unknown; error: { message: string } | null };

function rows<T>(schema: z.ZodType<T>, result: Result): T[] {
  if (result.error) throw new Error(result.error.message);
  return z.array(schema).parse(result.data ?? []);
}

export function supabaseCatalog(client: SupabaseClient): Catalog {
  return {
    async sellable(q) {
      const result = await client.rpc('sellable_pitch_types', {
        p_arrival: q.arrival,
        p_departure: q.departure,
        p_equipment: q.equipment,
        p_party_size: q.partySize,
        p_camping_id: q.campingId ?? null,
      });
      return rows(sellableRow, result).map((r) => ({
        campingId: r.camping_id,
        pitchTypeId: r.pitch_type_id,
      }));
    },

    async campings(ids) {
      if (ids.length === 0) return [];
      const result = await client
        .from('campings')
        .select('id, slug, name, region, lat, lng, short_descr, camping_photos(storage_path, sort)')
        .in('id', ids);
      return rows(campingRow, result).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        region: c.region,
        lat: c.lat,
        lng: c.lng,
        shortDescr: c.short_descr,
        coverPhoto: [...c.camping_photos].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null,
      }));
    },

    async rates(campingIds) {
      const cards = new Map<string, CampingRates>(
        campingIds.map((id) => [
          id,
          {
            seasons: [],
            prices: [],
            extras: [],
            fees: [],
            categories: [],
            names: { guest: {}, extra: {}, fee: {} },
          },
        ]),
      );
      if (campingIds.length === 0) return cards;
      const [seasons, categories, extras, fees] = await Promise.all([
        client.from('seasons').select('id, camping_id, dates').in('camping_id', campingIds),
        client
          .from('guest_categories')
          .select('id, camping_id, name, min_age, max_age')
          .in('camping_id', campingIds),
        // Partner members also see hidden extras: never offer those.
        client
          .from('extras')
          .select('id, camping_id, name, unit, max_qty')
          .in('camping_id', campingIds)
          .eq('active', true),
        client
          .from('fees')
          .select('id, camping_id, name, unit, amount_cents')
          .in('camping_id', campingIds),
      ]);
      const seasonRows = rows(seasonRow, seasons);
      const seasonCamping = new Map(seasonRows.map((s) => [s.id, s.camping_id]));
      for (const s of seasonRows) {
        const range = parseDateRange(s.dates);
        if (range) cards.get(s.camping_id)?.seasons.push({ id: s.id, ...range });
      }
      for (const c of rows(categoryRow, categories)) {
        const card = cards.get(c.camping_id);
        card?.categories.push({ id: c.id, minAge: c.min_age, maxAge: c.max_age });
        if (card) card.names.guest[c.id] = c.name;
      }
      for (const e of rows(extraRow, extras)) {
        const card = cards.get(e.camping_id);
        card?.extras.push({ id: e.id, unit: e.unit, maxQty: e.max_qty });
        if (card) card.names.extra[e.id] = e.name;
      }
      for (const f of rows(feeRow, fees)) {
        const card = cards.get(f.camping_id);
        card?.fees.push({ id: f.id, unit: f.unit, amountCents: f.amount_cents });
        if (card) card.names.fee[f.id] = f.name;
      }

      if (seasonRows.length > 0) {
        // PostgREST returns at most 1000 rows by default: plenty for the campings
        // of one search today; page through prices when that changes.
        const prices = await client
          .from('prices')
          .select('season_id, item_type, item_id, amount_cents')
          .in('season_id', [...seasonCamping.keys()]);
        for (const p of rows(priceRow, prices)) {
          const campingId = seasonCamping.get(p.season_id);
          if (!campingId) continue;
          cards.get(campingId)?.prices.push({
            seasonId: p.season_id,
            itemType: p.item_type,
            itemId: p.item_id,
            amountCents: p.amount_cents,
          });
        }
      }
      return cards;
    },

    async pitchType(pitchTypeId) {
      const result = await client
        .from('pitch_types')
        .select('camping_id, name')
        .eq('id', pitchTypeId)
        .eq('active', true)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      const row = z
        .object({ camping_id: z.string(), name: z.unknown() })
        .nullable()
        .parse(result.data);
      return row && { campingId: row.camping_id, name: row.name };
    },
  };
}
