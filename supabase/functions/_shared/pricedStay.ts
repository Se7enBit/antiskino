// Prices one stay at one pitch type with extras: shared by quote and create-booking.
import type { UnavailableReason } from './api.ts';
import type { Catalog, ItemNames } from './catalog.ts';
import { guestsByCategory, partySize } from './party.ts';
import { offeredExtras, priceStay, type Quote } from './pricing.ts';
import type { QuoteInput } from './stayInput.ts';

export type PricedStay = {
  available: true;
  campingId: string;
  pitchTypeName: unknown;
  /** Guests per guest category id. */
  guests: Record<string, number>;
  /** Extras with a positive quantity. */
  extras: Record<string, number>;
  partySize: number;
  quote: Quote;
  offeredExtras: string[];
  names: ItemNames;
};

export async function priceStayRequest(
  input: QuoteInput,
  catalog: Catalog,
): Promise<PricedStay | { available: false; reason: UnavailableReason }> {
  const pitchType = await catalog.pitchType(input.pitchTypeId);
  if (!pitchType) return { available: false, reason: 'not_found' };
  const { campingId } = pitchType;

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
  const extras = Object.fromEntries(Object.entries(input.extras).filter(([, qty]) => qty > 0));
  if (Object.keys(extras).some((id) => !offered.includes(id)))
    return { available: false, reason: 'extras' };

  const priced = priceStay(card, {
    pitchTypeId: input.pitchTypeId,
    arrival: input.arrival,
    departure: input.departure,
    guests,
    extras,
  });
  if (!priced.ok)
    return {
      available: false,
      reason:
        priced.error.code === 'too_many' || priced.error.code === 'unknown_extra'
          ? 'extras'
          : 'no_price',
    };
  return {
    available: true,
    campingId,
    pitchTypeName: pitchType.name,
    guests,
    extras,
    partySize: partySize(party),
    quote: priced.quote,
    offeredExtras: offered,
    names: card.names,
  };
}
