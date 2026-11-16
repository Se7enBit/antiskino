import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { addDays, isIsoDate, nightsBetween, stayNights, todayInAthens } from './dates.ts';

// The app's Jest suite (src/lib/__tests__/dates.test.ts) covers the same module in
// depth; these tests make sure it also behaves under Deno.

Deno.test('validates YYYY-MM-DD dates', () => {
  assertEquals(isIsoDate('2028-02-29'), true);
  assertEquals(isIsoDate('2026-02-29'), false);
  assertEquals(isIsoDate('2026-7-1'), false);
});

Deno.test('counts nights from arrival (inclusive) to departure (exclusive)', () => {
  assertEquals(nightsBetween('2026-07-01', '2026-07-04'), 3);
  assertEquals(stayNights('2026-03-28', '2026-03-31'), ['2026-03-28', '2026-03-29', '2026-03-30']);
  assertEquals(addDays('2026-12-31', 1), '2027-01-01');
});

Deno.test('throws on invalid dates', () => {
  assertThrows(() => addDays('2026-02-30', 1), RangeError);
});

Deno.test('today is computed in Europe/Athens', () => {
  assertEquals(todayInAthens(new Date('2026-06-30T21:00:00Z')), '2026-07-01');
  assertEquals(todayInAthens(new Date('2026-01-15T21:59:59Z')), '2026-01-15');
});
