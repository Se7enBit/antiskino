/**
 * The party of a search or booking: adults plus each child's age. Each person
 * is matched to the camping's guest category that covers their age (SPEC §0,
 * "Guests in search"). Keep this module free of imports and platform APIs: the
 * app imports it too.
 */

export type Party = { adults: number; childAges: number[] };

/** Adults are priced as this age. */
export const ADULT_AGE = 18;
export const MAX_ADULTS = 20;
export const MAX_CHILDREN = 10;

export type AgeCategory = { id: string; minAge: number; maxAge: number | null };

/** Everyone counts towards a pitch type's max_people, infants included. */
export function partySize(party: Party): number {
  return party.adults + party.childAges.length;
}

/** The ages of everyone in the party. */
export function partyAges(party: Party): number[] {
  return [...Array.from({ length: party.adults }, () => ADULT_AGE), ...party.childAges];
}

/**
 * Guests per category id, or null when someone's age fits no category (the
 * camping can't price that party). Categories of a camping never overlap.
 */
export function guestsByCategory(
  categories: AgeCategory[],
  party: Party,
): Record<string, number> | null {
  const guests: Record<string, number> = {};
  for (const age of partyAges(party)) {
    const category = categories.find(
      (c) => age >= c.minAge && (c.maxAge === null || age <= c.maxAge),
    );
    if (!category) return null;
    guests[category.id] = (guests[category.id] ?? 0) + 1;
  }
  return guests;
}
