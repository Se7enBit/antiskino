import type { BookingBreakdown, CreateBookingResponse } from '../_shared/api.ts';
import { type Booker, Unavailable } from '../_shared/booker.ts';
import type { Catalog } from '../_shared/catalog.ts';
import { priceStayRequest } from '../_shared/pricedStay.ts';
import type { CreateBookingInput } from '../_shared/stayInput.ts';
import { newManageToken, sha256Hex } from '../_shared/token.ts';

type Deps = { catalog: Catalog; booker: Booker; authorization: string | null };

/**
 * Books one stay (SPEC F3): prices it on the server, then reserves the nights
 * and creates the booking in one SQL transaction. The guest never sends a price.
 */
export async function createBooking(
  input: CreateBookingInput,
  { catalog, booker, authorization }: Deps,
): Promise<CreateBookingResponse> {
  const priced = await priceStayRequest(input, catalog);
  if (!priced.available) return { booked: false, reason: priced.reason };

  const manageToken = newManageToken();
  const breakdown: BookingBreakdown = {
    ...priced.quote,
    names: { pitch: priced.pitchTypeName, ...priced.names },
  };
  const { guest } = input;
  try {
    const reserved = await booker.reserve({
      pitchTypeId: input.pitchTypeId,
      arrival: input.arrival,
      departure: input.departure,
      equipment: input.equipment,
      party: priced.guests,
      extras: priced.extras,
      guest: {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        country: guest.country,
        locale: guest.locale,
        vehicle_plate: guest.vehiclePlate,
        arrival_eta: guest.arrivalEta,
        note: guest.note,
      },
      userId: await booker.userId(authorization),
      totalCents: priced.quote.totalCents,
      breakdown,
      manageTokenHash: await sha256Hex(manageToken),
    });
    return {
      booked: true,
      ref: reserved.ref,
      status: reserved.status,
      requestExpiresAt: reserved.requestExpiresAt,
      manageToken,
      totalCents: priced.quote.totalCents,
    };
  } catch (e) {
    // Taken by someone else between the price check and the reservation.
    if (e instanceof Unavailable) return { booked: false, reason: 'unavailable' };
    throw e;
  }
}
