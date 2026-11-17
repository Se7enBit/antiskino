import type { QuoteResponse } from '../_shared/api.ts';
import type { Catalog } from '../_shared/catalog.ts';
import { guestsByCategory, partySize } from '../_shared/party.ts';
import { offeredExtras, priceStay } from '../_shared/pricing.ts';
import type { QuoteInput } from '../_shared/stayInput.ts';

/** The price of one stay at one pitch type, with extras (SPEC F3 step 1). */
export async function quote(input: QuoteInput, catalog: Catalog): Promise<QuoteResponse> {
  const campingId = await catalog.pitchTypeCamping(input.pitchTypeId);
  if (!campingId) return { available: false, reason: 'not_found' };

  const party = { adults: input.adults, childAges: input.childAges };
  const sellable = await catalog.sellable({
    arrival: input.arrival,
    departure: input.departure,
    equipment: input.equipment,
    partySize: partySize(party),
    campingId,
  });
  if (!sellable.some((s) => s.pitchTypeId === input.pitchTypeId))
    return { available: false, reason: 'unavailable' };

  const card = (await catalog.rates([campingId])).get(campingId);
  const guests = card && guestsByCategory(card.categories, party);
  if (!card || !guests) return { available: false, reason: 'party' };

  const offered = offeredExtras(card, input.arrival, input.departure).map((e) => e.id);
  const extras = Object.entries(input.extras).filter(([, qty]) => qty > 0);
  if (extras.some(([id]) => !offered.includes(id))) return { available: false, reason: 'extras' };

  const priced = priceStay(card, {
    pitchTypeId: input.pitchTypeId,
    arrival: input.arrival,
    departure: input.departure,
    guests,
    extras: Object.fromEntries(extras),
  });
  if (!priced.ok)
    return {
      available: false,
      reason:
        priced.error.code === 'too_many' || priced.error.code === 'unknown_extra'
          ? 'extras'
          : 'no_price',
    };
  return { available: true, quote: priced.quote, offeredExtras: offered };
}
