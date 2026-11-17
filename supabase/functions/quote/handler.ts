import type { QuoteResponse } from '../_shared/api.ts';
import type { Catalog } from '../_shared/catalog.ts';
import { priceStayRequest } from '../_shared/pricedStay.ts';
import type { QuoteInput } from '../_shared/stayInput.ts';

/** The price of one stay at one pitch type, with extras (SPEC F3 step 1). */
export async function quote(input: QuoteInput, catalog: Catalog): Promise<QuoteResponse> {
  const priced = await priceStayRequest(input, catalog);
  if (!priced.available) return priced;
  return { available: true, quote: priced.quote, offeredExtras: priced.offeredExtras };
}
