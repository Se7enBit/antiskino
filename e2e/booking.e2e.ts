/// <reference types="node" />

import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

// SPEC §8: a guest books without an account, gets the email in their language,
// opens the manage link, sees and cancels the booking (0 refunded on site).
// Runs against the local Supabase stack and its seed: the live demo camping
// "demo-thalassa" with its tent pitch and 2027 allotments.

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const TENT_PITCH = 'c1000000-0000-4000-8000-000000000001';
const STAY = 'arrival=2027-07-10&departure=2027-07-13&adults=2&equipment=tent';

/** One value from the local database (psql, as the postgres superuser). */
function sql(query: string): string {
  return execFileSync('psql', [DB_URL, '-X', '-q', '-t', '-A', '-c', query], {
    encoding: 'utf8',
  }).trim();
}

const bookedOn = (night: string) =>
  Number(
    sql(
      `select booked from public.inventory_nights where pitch_type_id = '${TENT_PITCH}' and night = '${night}'`,
    ),
  );

test('the demo camping page is pre-rendered with its title and description', async ({
  request,
}) => {
  // The HTML as served, before any script runs (what link previews see).
  const html = await (await request.get('c/demo-thalassa')).text();
  expect(html).toContain('<title>Camping Thalassa (demo) · Antiskino</title>');
  expect(html).toMatch(/<meta property="og:title" content="Camping Thalassa \(demo\)"/);
  expect(html).toMatch(/<meta name="description" content="[^"]+"/);
  // schema.org data for search engines (scripts/seo.js), and a preview's noindex tag.
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1] ?? '{}';
  expect(JSON.parse(ld)).toMatchObject({
    '@type': 'Campground',
    name: 'Camping Thalassa (demo)',
    geo: { '@type': 'GeoCoordinates' },
  });
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  // The Content-Security-Policy (scripts/csp.js), first in <head>, with the
  // page's inline script allowed by its hash.
  expect(html).toMatch(
    /<head[^>]*><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/,
  );
});

test('a guest books without an account, then cancels with the manage link', async ({ page }) => {
  const before = bookedOn('2027-07-10');
  // The whole flow runs under the site's Content-Security-Policy without breaking it.
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });

  // The camping page quotes the stay; book the tent pitch.
  await page.goto(`c/demo-thalassa?${STAY}`);
  await page.getByTestId(`pitch-${TENT_PITCH}-book`).click();

  // Step 1: the stay as chosen.
  await page.getByTestId('booking-continue').click();

  // Step 2: the guest's details, with Greek for the emails.
  await page.getByTestId('guest-name').fill('Μαρία Παπαδοπούλου');
  await page.getByTestId('guest-email').fill('maria.e2e@example.org');
  await page.getByTestId('guest-phone').fill('+30 690 000 0000');
  await page.getByTestId('guest-country-GR').click();
  await page.getByTestId('guest-locale-el').click();
  await page.getByTestId('booking-continue').click();

  // Step 3: accept the terms and book.
  await page.getByTestId('booking-terms').click();
  await page.getByTestId('booking-submit').click();

  // Shown as "Reference: ANT-XXXXXX" in the page's language.
  const refText = (await page.getByTestId('booking-ref').textContent()) ?? '';
  const ref = /ANT-[0-9A-Z]{6}/.exec(refText)?.[0] ?? '';
  expect(ref).toMatch(/^ANT-[0-9A-Z]{6}$/);
  const link = (await page.getByTestId('booking-link').textContent())?.trim() ?? '';
  expect(link).toContain(`/m?ref=${ref}&t=`);

  // Confirmed at once (instant camping), in Greek, one night taken each night,
  // and the confirmation email queued for the guest.
  expect(
    sql(
      `select status || ' ' || locale || ' ' || guest_email from public.bookings where ref = '${ref}'`,
    ),
  ).toBe('confirmed el maria.e2e@example.org');
  expect(bookedOn('2027-07-10')).toBe(before + 1);
  expect(
    sql(
      `select count(*) from public.notification_queue q join public.bookings b on b.id = q.booking_id
       where b.ref = '${ref}' and q.kind = 'booking_confirmed' and q.audience = 'guest' and q.channel = 'email'`,
    ),
  ).toBe('1');

  // The manage link shows the booking and cancels it.
  await page.goto(link);
  await page.getByTestId('booking-cancel').click();
  await page.getByTestId('booking-cancel-yes').click();
  await expect
    .poll(() => sql(`select status from public.bookings where ref = '${ref}'`))
    .toBe('cancelled');
  await expect(page.getByTestId('booking-cancel')).toHaveCount(0);

  // Nothing was paid online, so nothing is refunded; the nights are free again.
  expect(sql(`select refunded_cents from public.bookings where ref = '${ref}'`)).toBe('0');
  expect(bookedOn('2027-07-10')).toBe(before);
  expect(violations).toEqual([]);
});
