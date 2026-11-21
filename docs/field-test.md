# Field test with the first camping (M6)

A checklist for trying Antiskino for real with one camping, on the dev project
and the preview website, before launch. Tick as you go; note problems with a
screenshot (Sentry catches app errors on its own).

The partner guide to hand to the camping is a separate document, in Greek and
English.

## 1. Before the visit

- [ ] Admin → New partner: the camping's business name and billing email; its
      commission (leave empty for the default 6%).
- [ ] Partner → add the camping (draft), then **Invite** the owner by email and
      send them the link (WhatsApp is fine). Invite reception staff the same way,
      as Staff.
- [ ] Ask the camping for: its pitch types (how many of each, size, what they
      accept, how many people), seasons with dates and minimum nights, prices
      per pitch, per person (age groups) and extras, check-in/out times, and how
      many pitches it wants to sell online (keep some for phone and walk-ins).
- [ ] Remove the demo campings if they'd confuse the camping: they're only in
      the dev project; leave them if you want to compare.

## 2. Setting up together (about an hour)

- [ ] The owner signs in on their phone (email code) and installs the preview
      APK; reception staff too. Allow notifications.
- [ ] **Profile**: texts in Greek and English, address and map pin, phone,
      email, check-in/out times, amenities, photos (cover photo first),
      confirmation (instant or on request) and cancellation policy.
- [ ] **Pitch types**: each type with what it accepts, maximum people, photos.
- [ ] **Rates**: guest categories by age, extras (car, electricity, dog…), any
      fixed fees, the seasons, then the prices for each season.
- [ ] **Calendar**: the allotment for each pitch type for the season; close the
      nights they don't sell online.
- [ ] Admin → set the camping **live**. Within about 7 minutes the website
      rebuilds with its page.
- [ ] Compare a few quotes with the camping's own price list (a weekend, a week
      across two seasons, a family with a child and a car). Any difference is a
      bug or a missing rule: write it down.

## 3. Trying it at reception

- [ ] Book from your phone as a guest (web, no account). Check on the reception
      phone: a push arrives and **Today** shows the booking without reloading.
      (This ticks the last two items of SPEC §8.)
- [ ] If the camping works on request: send a request; accept one, decline one,
      and let one run past its deadline (it expires and the guest is told).
- [ ] On the arrival day: **Check in**, assign a pitch, add an internal note.
      Try **No-show** on a test booking.
- [ ] Cancel a booking from the guest's link: the nights become free again on
      the **Calendar**.
- [ ] The camping cancels one with a reason: the guest sees the reason.
- [ ] The day after a stay ends, the guest is invited to review; the camping
      replies under **Reviews**.
- [ ] Team: the owner invites a staff member; staff can work bookings but not
      change prices.
- [ ] Emails reach guests only once the Resend domain is verified; until then
      check them in Admin → **Messages**.

## 4. Questions for the camping

- What was confusing, slow or missing at reception?
- Are there charges we can't express yet (tourist tax, deposits, seasonal
  extras, discounts for long stays)?
- Do they sell on other sites or use a property management system? How do they
  want to keep the online allotment in step?
- How do they handle walk-ins and phone bookings today?
- Would they keep using it? What would make them recommend it to another camping?

## 5. Afterwards

- [ ] Turn the answers into a short list of changes, and decide which come
      before launch.
- [ ] Tick SPEC §8 (Today live update and push) and mark the field test done in
      CLAUDE.md's milestone line.
