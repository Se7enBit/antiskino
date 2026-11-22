// A fake Supabase with three demo campings and a partner's day, just enough for
// the screenshots: REST reads, the search and quote functions, photos and the
// signed-in user. Not a test double for anything else.
const { Buffer } = require('buffer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const day = (offset) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Athens' }));
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const T = (el, en) => ({ el, en });
const C1 = 'd1000000-0000-4000-8000-000000000001';
const C2 = 'd1000000-0000-4000-8000-000000000002';
const C3 = 'd1000000-0000-4000-8000-000000000003';
const P11 = 'd2000000-0000-4000-8000-000000000011';
const P12 = 'd2000000-0000-4000-8000-000000000012';
const S1 = 'd3000000-0000-4000-8000-000000000001';

const campings = [
  {
    id: C1,
    partner_id: 'p1',
    slug: 'thalassa',
    status: 'live',
    name: 'Camping Thalassa',
    region: 'halkidiki',
    short_descr: T(
      'Σκιερές θέσεις δίπλα στη θάλασσα της Σιθωνίας.',
      'Shady pitches right by the sea in Sithonia.',
    ),
    descr: T(
      'Ήσυχο οικογενειακό κάμπινγκ με πεύκα, αμμουδιά και ταβέρνα. Η θάλασσα είναι στα δύο βήματα από κάθε θέση.',
      'A quiet family camping with pine trees, a sandy beach and a taverna. The sea is a few steps from every pitch.',
    ),
    house_rules: T(
      'Ησυχία 23:00–08:00. Τα σκυλιά με λουρί.',
      'Quiet hours 23:00–08:00. Dogs on a lead.',
    ),
    address: 'Sarti, Sithonia, 630 72 Halkidiki',
    lat: 40.0915,
    lng: 23.98,
    phone: '+30 2375 000000',
    amenities: [
      'hot_showers',
      'electricity',
      'wifi',
      'beach_access',
      'mini_market',
      'restaurant',
      'shade',
      'pets_allowed',
    ],
    check_in_from: '14:00',
    check_out_until: '12:00',
    confirmation_mode: 'instant',
    request_expiry_hours: 24,
    payment_mode: 'on_site',
    cancellation_policy: 'moderate',
    camping_photos: [
      { storage_path: `${C1}/thalassa-1.jpg`, sort: 1 },
      { storage_path: `${C1}/thalassa-2.jpg`, sort: 2 },
    ],
    rating: { average: 4.7, count: 23 },
    from: 8640,
  },
  {
    id: C2,
    partner_id: 'p1',
    slug: 'pefka',
    status: 'live',
    name: 'Camping Pefka',
    region: 'pelion',
    short_descr: T(
      'Θέσεις κάτω από τα πεύκα, στους πρόποδες του Πηλίου.',
      'Pitches under the pines at the foot of Mount Pelion.',
    ),
    descr: T(
      'Δροσερό κάμπινγκ κοντά σε χωριά και μονοπάτια.',
      'A cool camping near villages and hiking paths.',
    ),
    house_rules: T('Φωτιές μόνο στις ψησταριές.', 'Fires only in the barbecue area.'),
    address: 'Kala Nera, 370 10 Magnesia',
    lat: 39.3176,
    lng: 23.1167,
    phone: '+30 2423 000000',
    amenities: ['hot_showers', 'electricity', 'wifi', 'bbq', 'playground', 'shade', 'laundry'],
    check_in_from: '13:00',
    check_out_until: '11:00',
    confirmation_mode: 'request',
    request_expiry_hours: 24,
    payment_mode: 'on_site',
    cancellation_policy: 'flexible',
    camping_photos: [{ storage_path: `${C2}/pefka-1.jpg`, sort: 1 }],
    rating: { average: 4.5, count: 11 },
    from: 9520,
  },
  {
    id: C3,
    partner_id: 'p1',
    slug: 'kastri',
    status: 'live',
    name: 'Camping Kastri',
    region: 'peloponnese',
    short_descr: T(
      'Πεζούλες με θέα στη λίμνη και τα βουνά.',
      'Terraces with views of the lake and the mountains.',
    ),
    descr: T(
      'Μικρό κάμπινγκ με πισίνα και θέα στο ηλιοβασίλεμα.',
      'A small camping with a pool and sunset views.',
    ),
    house_rules: T('Η πισίνα είναι ανοιχτή 09:00–20:00.', 'The pool is open 09:00–20:00.'),
    address: 'Kardamyli, 240 22 Messinia',
    lat: 36.887,
    lng: 22.233,
    phone: '+30 2721 000000',
    amenities: ['hot_showers', 'electricity', 'pool', 'bar', 'shared_kitchen'],
    check_in_from: '15:00',
    check_out_until: '11:00',
    confirmation_mode: 'instant',
    request_expiry_hours: 24,
    payment_mode: 'on_site',
    cancellation_policy: 'strict',
    camping_photos: [{ storage_path: `${C3}/kastri-1.jpg`, sort: 1 }],
    rating: { average: 4.8, count: 17 },
    from: 10880,
  },
];

const pitchTypes = [
  {
    id: P11,
    camping_id: C1,
    name: T('Θέση σκηνής', 'Tent pitch'),
    descr: T(
      'Σκιερή θέση στα πεύκα, 30 μέτρα από τη θάλασσα.',
      'A shady pitch under the pines, 30 metres from the sea.',
    ),
    included: T('Ντους και κοινόχρηστοι χώροι', 'Showers and shared facilities'),
    accepts: ['tent'],
    max_people: 4,
    size_m2: 50,
    photos: [],
    active: true,
    sort: 1,
  },
  {
    id: P12,
    camping_id: C1,
    name: T('Θέση τροχόσπιτου', 'Caravan pitch'),
    descr: T('Μεγάλη θέση με ρεύμα και νερό.', 'A large pitch with electricity and water.'),
    included: T('Ρεύμα και νερό στη θέση', 'Electricity and water at the pitch'),
    accepts: ['caravan', 'camper'],
    max_people: 6,
    size_m2: 80,
    photos: [],
    active: true,
    sort: 2,
  },
];

const guestCategories = [
  { id: 'g-adult', name: T('Ενήλικας', 'Adult'), min_age: 12, max_age: null, sort: 1 },
  { id: 'g-child', name: T('Παιδί', 'Child'), min_age: 4, max_age: 11, sort: 2 },
  { id: 'g-baby', name: T('Βρέφος', 'Baby'), min_age: 0, max_age: 3, sort: 3 },
];
const extras = [
  {
    id: 'e-car',
    name: T('Αυτοκίνητο', 'Car'),
    unit: 'per_night',
    max_qty: 2,
    active: true,
    sort: 1,
  },
  {
    id: 'e-power',
    name: T('Ρεύμα', 'Electricity'),
    unit: 'per_night',
    max_qty: 1,
    active: true,
    sort: 2,
  },
  { id: 'e-dog', name: T('Σκύλος', 'Dog'), unit: 'per_night', max_qty: 2, active: true, sort: 3 },
];
const fees = [{ id: 'f-tax', name: T('Τέλος διαμονής', 'Stay tax'), unit: 'per_stay' }];

const reviews = [
  {
    id: 'r1',
    rating: 5,
    body: 'Υπέροχο κάμπινγκ, καθαρά μπάνια και η θάλασσα στα δύο βήματα!',
    author_name: 'Κατερίνα',
    author_country: 'GR',
    stay_month: '2026-08-01',
    partner_reply: 'Ευχαριστούμε πολύ, σας περιμένουμε ξανά!',
    created_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'r2',
    rating: 5,
    body: 'The best beach of our trip and very friendly staff.',
    author_name: 'Maria',
    author_country: 'ES',
    stay_month: '2026-08-01',
    partner_reply: null,
    created_at: '2026-08-15T10:00:00Z',
  },
  {
    id: 'r3',
    rating: 4,
    body: 'Lovely spot with plenty of shade. We will come back.',
    author_name: 'Jan',
    author_country: 'NL',
    stay_month: '2026-07-01',
    partner_reply: null,
    created_at: '2026-07-28T10:00:00Z',
  },
];

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const partnerBookings = [
  {
    id: 'b1',
    ref: 'ANT-7KQ2',
    status: 'confirmed',
    arrival: day(0),
    departure: day(4),
    nights: 4,
    equipment: 'tent',
    party_size: 4,
    total_cents: 13360,
    guest_name: 'Νίκος Παπαδόπουλος',
    guest_email: 'n@example.org',
    guest_phone: '+30 690 000 0000',
    guest_country: 'GR',
    guest_note: null,
    arrival_eta: '15:30',
    vehicle_plate: null,
    request_expires_at: null,
    cancel_reason: null,
    assigned_pitch: null,
    created_at: iso(now - 864e5 * 9),
    pitch_type: { name: pitchTypes[0].name },
  },
  {
    id: 'b2',
    ref: 'ANT-3MX9',
    status: 'confirmed',
    arrival: day(0),
    departure: day(7),
    nights: 7,
    equipment: 'caravan',
    party_size: 2,
    total_cents: 22400,
    guest_name: 'Anna Schmidt',
    guest_email: 'a@example.org',
    guest_phone: '+49 151 0000000',
    guest_country: 'DE',
    guest_note: null,
    arrival_eta: '18:00',
    vehicle_plate: 'M AS 123',
    request_expires_at: null,
    cancel_reason: null,
    assigned_pitch: 'B14',
    created_at: iso(now - 864e5 * 20),
    pitch_type: { name: pitchTypes[1].name },
  },
  {
    id: 'b3',
    ref: 'ANT-9TR4',
    status: 'checked_in',
    arrival: day(-3),
    departure: day(0),
    nights: 3,
    equipment: 'tent',
    party_size: 2,
    total_cents: 7200,
    guest_name: 'Luca Bianchi',
    guest_email: 'l@example.org',
    guest_phone: '+39 333 000 0000',
    guest_country: 'IT',
    guest_note: null,
    arrival_eta: null,
    vehicle_plate: null,
    request_expires_at: null,
    cancel_reason: null,
    assigned_pitch: 'A03',
    created_at: iso(now - 864e5 * 30),
    pitch_type: { name: pitchTypes[0].name },
  },
  ...['A05', 'A07', 'B02', 'B09', 'C01'].map((pitch, i) => ({
    id: `bh${i}`,
    ref: `ANT-H${i}Z${i}`,
    status: 'checked_in',
    arrival: day(-1 - i),
    departure: day(2 + i),
    nights: 3 + 2 * i,
    equipment: 'tent',
    party_size: 2 + (i % 3),
    total_cents: 9000,
    guest_name: `Guest ${i}`,
    guest_email: 'g@example.org',
    guest_phone: '+30 690 000 0000',
    guest_country: 'GR',
    guest_note: null,
    arrival_eta: null,
    vehicle_plate: null,
    request_expires_at: null,
    cancel_reason: null,
    assigned_pitch: pitch,
    created_at: iso(now - 864e5 * 40),
    pitch_type: { name: pitchTypes[0].name },
  })),
  {
    id: 'b4',
    ref: 'ANT-5PL8',
    status: 'requested',
    arrival: day(12),
    departure: day(16),
    nights: 4,
    equipment: 'camper',
    party_size: 3,
    total_cents: 16800,
    guest_name: 'Sophie Martin',
    guest_email: 's@example.org',
    guest_phone: '+33 6 00 00 00 00',
    guest_country: 'FR',
    guest_note: null,
    arrival_eta: null,
    vehicle_plate: null,
    request_expires_at: iso(now + 3600e3 * 9.4),
    cancel_reason: null,
    assigned_pitch: null,
    created_at: iso(now - 3600e3 * 2),
    pitch_type: { name: pitchTypes[1].name },
  },
];

const user = {
  id: 'u1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.org',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

function quote(body) {
  const nights = [];
  const n = Math.max(
    1,
    Math.round((Date.parse(body.departure) - Date.parse(body.arrival)) / 864e5),
  );
  for (let i = 0; i < n; i++)
    nights.push({
      night: new Date(Date.parse(body.arrival) + i * 864e5).toISOString().slice(0, 10),
      seasonId: S1,
      totalCents: 3340,
    });
  const lines = [
    { kind: 'pitch', id: body.pitchTypeId || P11, quantity: 1, per: 'night', totalCents: 1200 * n },
    { kind: 'guest', id: 'g-adult', quantity: 2, per: 'night', totalCents: 1600 * n },
    { kind: 'guest', id: 'g-child', quantity: 1, per: 'night', totalCents: 400 * n },
    ...Object.entries(body.extras || {})
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        kind: 'extra',
        id,
        quantity: qty,
        per: 'night',
        totalCents: 300 * qty * n,
      })),
    { kind: 'fee', id: 'f-tax', quantity: 1, per: 'stay', totalCents: 200 },
  ];
  return {
    available: true,
    quote: { nights, lines, totalCents: lines.reduce((s, l) => s + l.totalCents, 0) },
    offeredExtras: ['e-car', 'e-power', 'e-dog'],
  };
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, {
    'content-type': type,
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': '*',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function start(port, photosDir) {
  return http
    .createServer((req, res) => {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      const q = Object.fromEntries(url.searchParams);
      const single = (req.headers.accept || '').includes('vnd.pgrst.object');
      const rows = (list) => send(res, 200, single ? (list[0] ?? null) : list);
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        if (p.startsWith('/storage/')) {
          const file = path.join(photosDir, path.basename(p));
          return fs.existsSync(file)
            ? send(res, 200, fs.readFileSync(file), 'image/jpeg')
            : send(res, 404, '');
        }
        if (p === '/functions/v1/search') {
          return send(res, 200, {
            results: campings.map((c) => ({
              camping: {
                id: c.id,
                slug: c.slug,
                name: c.name,
                region: c.region,
                lat: c.lat,
                lng: c.lng,
                shortDescr: c.short_descr,
                coverPhoto: c.camping_photos[0].storage_path,
                rating: c.rating,
              },
              fromTotalCents: c.from,
              pitchTypes:
                c.id === C1
                  ? [
                      { id: P11, totalCents: 8640 },
                      { id: P12, totalCents: 12320 },
                    ]
                  : [],
            })),
          });
        }
        if (p === '/functions/v1/quote') return send(res, 200, quote(body));
        if (p.startsWith('/auth/v1/user')) return send(res, 200, user);
        if (p.startsWith('/auth/v1/')) return send(res, 200, {});
        const table = p.replace('/rest/v1/', '');
        switch (table) {
          case 'campings': {
            if (q.slug) {
              const c = campings.find((x) => `eq.${x.slug}` === q.slug);
              return rows(
                c
                  ? [
                      {
                        ...c,
                        pitch_types: pitchTypes.filter((t) => t.camping_id === c.id),
                        seasons: [{ id: S1, dates: `[${day(-30)},${day(150)})` }],
                      },
                    ]
                  : [],
              );
            }
            if (q.partner_id || q.id) return rows([campings[0]]);
            return rows(campings);
          }
          case 'camping_ratings':
            return rows(
              campings
                .filter((c) => !q.camping_id || q.camping_id === `eq.${c.id}`)
                .map((c) => ({
                  camping_id: c.id,
                  rating_avg: c.rating.average,
                  review_count: c.rating.count,
                })),
            );
          case 'prices':
            return rows([
              { season_id: S1, item_id: P11, amount_cents: 1200 },
              { season_id: S1, item_id: P12, amount_cents: 1800 },
            ]);
          case 'reviews':
            return rows(reviews);
          case 'pitch_types': {
            const t = pitchTypes.find((x) => `eq.${x.id}` === q.id) || pitchTypes[0];
            const c = campings.find((x) => x.id === t.camping_id);
            return rows([
              { ...t, camping: { ...c, extras, guest_categories: guestCategories, fees } },
            ]);
          }
          case 'profiles':
            return rows([
              {
                is_platform_admin: false,
                full_name: 'Owner',
                phone: null,
                country: 'GR',
                locale: 'el',
              },
            ]);
          case 'partner_members':
            return rows([{ partner_id: 'p1', role: 'owner', partners: { name: 'Demo' } }]);
          case 'bookings':
            return rows(partnerBookings);
          default:
            return rows([]);
        }
      });
    })
    .listen(port, '127.0.0.1');
}

module.exports = { start };
