import { assertEquals } from 'jsr:@std/assert@1';

import { guestsByCategory, partyAges, partySize } from './party.ts';

const CATEGORIES = [
  { id: 'adult', minAge: 12, maxAge: null },
  { id: 'child', minAge: 4, maxAge: 11 },
  { id: 'infant', minAge: 0, maxAge: 3 },
];

Deno.test('counts everyone, infants included', () => {
  const party = { adults: 2, childAges: [0, 7] };
  assertEquals(partySize(party), 4);
  assertEquals(partyAges(party), [18, 18, 0, 7]);
});

Deno.test('matches each person to the category covering their age', () => {
  assertEquals(guestsByCategory(CATEGORIES, { adults: 2, childAges: [3, 4, 11, 12] }), {
    adult: 3,
    infant: 1,
    child: 2,
  });
});

Deno.test('a party with an age no category covers cannot be priced', () => {
  const noInfants = CATEGORIES.filter((c) => c.id !== 'infant');
  assertEquals(guestsByCategory(noInfants, { adults: 1, childAges: [2] }), null);
  assertEquals(guestsByCategory(noInfants, { adults: 1, childAges: [] }), { adult: 1 });
  assertEquals(guestsByCategory([], { adults: 1, childAges: [] }), null);
});
