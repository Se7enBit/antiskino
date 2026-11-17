import type { SearchResponse, SearchResult } from '../_shared/api.ts';
import type { Catalog } from '../_shared/catalog.ts';
import { guestsByCategory, partySize } from '../_shared/party.ts';
import { priceStay } from '../_shared/pricing.ts';
import type { SearchInput } from '../_shared/stayInput.ts';

/**
 * Campings with at least one pitch type sellable and priced for the whole
 * stay, cheapest first (SPEC F1). A camping that can't price the party (an age
 * outside its guest categories, a missing price) is left out.
 */
export async function search(input: SearchInput, catalog: Catalog): Promise<SearchResponse> {
  const party = { adults: input.adults, childAges: input.childAges };
  const sellable = await catalog.sellable({
    arrival: input.arrival,
    departure: input.departure,
    equipment: input.equipment,
    partySize: partySize(party),
    campingId: input.campingId,
  });
  const campingIds = [...new Set(sellable.map((s) => s.campingId))];
  const [campings, rates] = await Promise.all([
    catalog.campings(campingIds),
    catalog.rates(campingIds),
  ]);

  const results: SearchResult[] = [];
  for (const camping of campings) {
    if (input.region && camping.region !== input.region) continue;
    const card = rates.get(camping.id);
    const guests = card && guestsByCategory(card.categories, party);
    if (!card || !guests) continue;
    const pitchTypes = sellable
      .filter((s) => s.campingId === camping.id)
      .flatMap(({ pitchTypeId }) => {
        const priced = priceStay(card, {
          pitchTypeId,
          arrival: input.arrival,
          departure: input.departure,
          guests,
        });
        return priced.ok ? [{ id: pitchTypeId, totalCents: priced.quote.totalCents }] : [];
      });
    if (pitchTypes.length === 0) continue;
    const fromTotalCents = Math.min(...pitchTypes.map((p) => p.totalCents));
    results.push({ camping, fromTotalCents, pitchTypes });
  }
  results.sort(
    (a, b) => a.fromTotalCents - b.fromTotalCents || a.camping.name.localeCompare(b.camping.name),
  );
  return { results };
}
