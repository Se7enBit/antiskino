import { expect, test } from '@playwright/test';

import { signIn, sql, watchCsp } from './helpers';

// The camping's and Antiskino's side (SPEC F11, F12), against the local stack
// and its seed: the owner of the demo partner answers a request at
// "demo-pefka" (bookings by request) and checks a guest in at "demo-thalassa"
// on the arrival day; the admin corrects a guest's phone and cancels the
// booking with a reason. Each test makes its own bookings, with emails unique
// to the run.

const OWNER = 'owner@antiskino.test';
const ADMIN = 'admin@antiskino.test';
const THALASSA = 'c0000000-0000-4000-8000-000000000001';
const THALASSA_TENT = 'c1000000-0000-4000-8000-000000000001';
const THALASSA_ADULT = 'c3000000-0000-4000-8000-000000000001';
const PEFKA_TENT = 'c1000000-0000-4000-8000-000000000011';
const RUN = Date.now().toString(36);

const statusOf = (ref: string) => sql(`select status from public.bookings where ref = '${ref}'`);

/** How many messages of a kind are queued for the booking's guest by email. */
const guestEmails = (ref: string, kind: string) =>
  sql(
    `select count(*) from public.notification_queue q join public.bookings b on b.id = q.booking_id
     where b.ref = '${ref}' and q.kind = '${kind}' and q.audience = 'guest' and q.channel = 'email'`,
  );

test('the camping accepts a guest’s request from Today', async ({ page }) => {
  const violations = watchCsp(page);

  // The guest asks for three nights at the camping that books by request.
  await page.goto('c/demo-pefka?arrival=2027-08-02&departure=2027-08-05&adults=2&equipment=tent');
  await page.getByTestId(`pitch-${PEFKA_TENT}-book`).click();
  await page.getByTestId('booking-continue').click();
  await page.getByTestId('guest-name').fill('Lena Weber');
  await page.getByTestId('guest-email').fill(`lena.${RUN}@example.org`);
  await page.getByTestId('guest-phone').fill('+30 690 000 0001');
  await page.getByTestId('guest-country-GR').click();
  await page.getByTestId('guest-locale-en').click();
  await page.getByTestId('booking-continue').click();
  await page.getByTestId('booking-terms').click();
  await page.getByTestId('booking-submit').click();
  const ref = /ANT-[0-9A-Z]{6}/.exec(
    (await page.getByTestId('booking-ref').textContent()) ?? '',
  )?.[0];
  expect(ref).toMatch(/^ANT-[0-9A-Z]{6}$/);
  expect(statusOf(ref!)).toBe('requested');
  expect(guestEmails(ref!, 'request_received')).toBe('1');

  // The owner opens Today, picks the camping and accepts the request.
  await signIn(page, OWNER);
  await page.goto('partner');
  await page.getByTestId('camping-switch-demo-pefka').click();
  await page.getByTestId(`accept-${ref}`).click();
  await expect.poll(() => statusOf(ref!)).toBe('confirmed');
  await expect(page.getByTestId(`accept-${ref}`)).toHaveCount(0);

  // Recorded as the camping's answer, and the guest is told.
  expect(
    sql(
      `select e.actor_kind || ' ' || e.from_status || '>' || e.to_status from public.booking_events e
       join public.bookings b on b.id = e.booking_id where b.ref = '${ref}' order by e.id desc limit 1`,
    ),
  ).toBe('partner requested>confirmed');
  expect(guestEmails(ref!, 'booking_confirmed')).toBe('1');
  expect(violations).toEqual([]);
});

test('the camping checks a guest in on the arrival day', async ({ page }) => {
  const violations = watchCsp(page);
  // A confirmed stay that starts today in Athens (the seed's seasons are in
  // 2027, so it's added directly; checking in doesn't touch the nights).
  const ref = sql(`
    insert into public.bookings (ref, camping_id, pitch_type_id, guest_name, guest_email, guest_phone,
      guest_country, locale, arrival, departure, equipment, party, party_size, status, total_cents,
      price_breakdown, payment_mode, cancellation_policy, commission_bps, commission_cents, manage_token_hash)
    select public.new_booking_ref(), '${THALASSA}', '${THALASSA_TENT}', 'Jonas Berg',
      'jonas.${RUN}@example.org', '+46 70 000 0000', 'SE', 'en', d, d + 2, 'tent',
      '{"${THALASSA_ADULT}": 2}', 2, 'confirmed', 6000, '{}', 'on_site', 'moderate', 600, 360,
      public.sha256_hex('e2e-checkin-${RUN}')
    from (select (now() at time zone 'Europe/Athens')::date as d) today
    returning ref`);
  expect(ref).toMatch(/^ANT-[0-9A-Z]{6}$/);

  // Today lists the arrival; check-in from its card.
  await signIn(page, OWNER);
  await page.goto('partner');
  await page.getByTestId('camping-switch-demo-thalassa').click();
  await page.getByTestId(`check-in-${ref}`).click();
  await expect.poll(() => statusOf(ref)).toBe('checked_in');
  await expect(page.getByTestId(`check-in-${ref}`)).toHaveCount(0);

  // The booking page: the pitch number for reception.
  await page.goto(`partner/bookings/detail?ref=${ref}`);
  await page.getByTestId('desk-pitch').fill('A7');
  await page.getByTestId('desk-save').click();
  await expect
    .poll(() => sql(`select assigned_pitch from public.bookings where ref = '${ref}'`))
    .toBe('A7');
  expect(violations).toEqual([]);
});

test('the admin corrects a guest’s phone and cancels the booking with a reason', async ({
  page,
}) => {
  const violations = watchCsp(page);
  const nights = () =>
    sql(
      `select booked from public.inventory_nights where pitch_type_id = '${THALASSA_TENT}' and night = '2027-08-10'`,
    );
  const before = Number(nights());
  // A confirmed booking, made the way create-booking makes one (it takes the nights).
  const ref = sql(`
    select ref from public.reserve_and_create_booking(
      '${THALASSA_TENT}', '2027-08-10', '2027-08-13', 'tent', '{"${THALASSA_ADULT}": 2}', '{}',
      '{"name": "Sofia Rossi", "email": "sofia.${RUN}@example.org", "phone": "+39 320 000 0000",
        "country": "IT", "locale": "en"}',
      null, 12000, '{}', public.sha256_hex('e2e-admin-${RUN}'))`);
  expect(statusOf(ref)).toBe('confirmed');
  expect(Number(nights())).toBe(before + 1);

  // Admin → Bookings → the booking.
  await signIn(page, ADMIN);
  await page.goto('admin/bookings');
  await page.getByTestId(`admin-booking-${ref}`).click();
  await expect(page).toHaveURL(new RegExp(`admin/booking\\?ref=${ref}`));

  // The guest called with a new number.
  await page.getByTestId('admin-edit-guest').click();
  await page.getByTestId('admin-guest-phone').fill('+39 320 111 2222');
  await page.getByTestId('admin-guest-save').click();
  await expect
    .poll(() => sql(`select guest_phone from public.bookings where ref = '${ref}'`))
    .toBe('+39 320 111 2222');

  // The camping can't host them: cancelled with a reason, as Antiskino.
  await page.getByTestId(`cancel-${ref}`).click();
  await page.getByTestId(`cancel-reason-${ref}`).fill('The camping closed after a storm');
  await page.getByTestId(`cancel-confirm-${ref}`).click();
  await expect.poll(() => statusOf(ref)).toBe('cancelled');
  expect(sql(`select cancel_reason from public.bookings where ref = '${ref}'`)).toBe(
    'The camping closed after a storm',
  );
  expect(
    sql(
      `select string_agg(e.actor_kind || ' ' || e.from_status || '>' || e.to_status, ', ' order by e.id)
       from public.booking_events e join public.bookings b on b.id = e.booking_id
       where b.ref = '${ref}' and e.actor_kind = 'admin'`,
    ),
  ).toBe('admin confirmed>confirmed, admin confirmed>cancelled');
  expect(guestEmails(ref, 'booking_cancelled')).toBe('1');
  // The nights are free again.
  expect(Number(nights())).toBe(before);
  expect(violations).toEqual([]);
});
