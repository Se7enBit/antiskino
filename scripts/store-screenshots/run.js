// Store screenshots (Google Play: 1080 × 1920, Greek and English) from the web
// build, with three demo campings served by a fake Supabase (fake-supabase.js)
// and drawn photos (scenes.js). Each image is a phone-sized screenshot under a
// caption on the brand colour. Writes assets/store/screenshots/<el|en>/*.png.
// Usage: node scripts/store-screenshots/run.js   (needs Playwright's Chromium)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const scenes = require('./scenes');
const { start } = require('./fake-supabase');

const API_PORT = 54398;
const SITE_PORT = 8095;
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'assets', 'store', 'screenshots');
const STAY = 'arrival=2027-07-10&departure=2027-07-14&adults=2&children=7&equipment=tent';
const PITCH = 'd2000000-0000-4000-8000-000000000011';
const log = (message) => process.stdout.write(`${message}\n`);

/** Name, path, signed in as a partner owner, and what to scroll to. */
const SHOTS = [
  { name: '01-search', url: '/' },
  { name: '02-results', url: `/search?${STAY}` },
  { name: '03-camping', url: `/c/thalassa?${STAY}` },
  { name: '04-pitches', url: `/c/thalassa?${STAY}`, scrollTo: /^(Θέση σκηνής|Tent pitch)$/ },
  { name: '05-booking', url: `/book?pitchType=${PITCH}&${STAY}`, scrollTo: /^(Σύνολο|Total)$/ },
  { name: '06-today', url: '/partner', partner: true },
];

const CAPTIONS = {
  el: {
    '01-search': 'Βρες θέση σε κάμπινγκ σε όλη την Ελλάδα',
    '02-results': 'Δες την τιμή για όλη τη διαμονή',
    '03-camping': 'Φωτογραφίες, παροχές και αληθινές αξιολογήσεις',
    '04-pitches': 'Σκηνή, τροχόσπιτο ή αυτοκινούμενο',
    '05-booking': 'Κράτηση σε ένα λεπτό, πληρωμή στη ρεσεψιόν',
    '06-today': 'Για τα κάμπινγκ: η ρεσεψιόν στο κινητό',
  },
  en: {
    '01-search': 'Find a camping pitch anywhere in Greece',
    '02-results': 'See the price of your whole stay',
    '03-camping': 'Photos, amenities and real reviews',
    '04-pitches': 'Tent, caravan or camper',
    '05-booking': 'Book in a minute, pay at reception',
    '06-today': 'For campings: reception on your phone',
  },
};

const SESSION = {
  access_token: 'fake.jwt.token',
  refresh_token: 'fake',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@example.org',
    app_metadata: {},
    user_metadata: {},
  },
};

async function renderPhotos(browser, dir) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  for (const [name, svg] of Object.entries(scenes)) {
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: path.join(dir, `${name}.jpg`), type: 'jpeg', quality: 85 });
  }
  await page.close();
}

/** The web export; async, because the fake Supabase in this process answers its pre-rendering. */
async function exportSite(dir) {
  const child = spawn('npx', ['expo', 'export', '-p', 'web', '--output-dir', dir], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${API_PORT}`,
      EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_screenshots',
    },
  });
  const status = await new Promise((resolve) => child.on('close', resolve));
  if (status !== 0) throw new Error('expo export failed');
  // Like the Website workflow: the static server answers unknown paths with it.
  fs.copyFileSync(path.join(dir, '+not-found.html'), path.join(dir, '404.html'));
}

async function shoot(browser, lang, shot, file) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    locale: lang === 'el' ? 'el-GR' : 'en-US',
    timezoneId: 'Europe/Athens',
  });
  if (shot.partner) {
    // The key supabase-js uses for a project at 127.0.0.1.
    await context.addInitScript(
      (session) => localStorage.setItem('sb-127-auth-token', session),
      JSON.stringify(SESSION),
    );
  }
  const page = await context.newPage();
  page.on('pageerror', (error) => log(`${lang} ${shot.name}: ${error.message}`));
  await page.goto(`http://127.0.0.1:${SITE_PORT}/antiskino${shot.url}`);
  await page.waitForTimeout(3500);
  if (shot.scrollTo) {
    await page
      .getByText(shot.scrollTo)
      .last()
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: file });
  await context.close();
}

async function frame(page, screenshot, caption, file) {
  const image = fs.readFileSync(screenshot).toString('base64');
  await page.setContent(`<html><body style="margin:0;width:1080px;height:1920px;overflow:hidden;background:#1F6F4A;font-family:Inter,sans-serif">
    <div style="height:330px;display:flex;align-items:center;justify-content:center;padding:0 80px;box-sizing:border-box">
      <div style="color:#fff;font-size:70px;font-weight:800;line-height:1.15;text-align:center;letter-spacing:-0.5px">${caption}</div>
    </div>
    <img src="data:image/png;base64,${image}" style="display:block;margin:0 auto;width:880px;border-radius:44px;box-shadow:0 24px 60px rgba(0,0,0,.35);border:10px solid #10402a">
  </body></html>`);
  await page.screenshot({ path: file });
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-screenshots-'));
  const photos = path.join(work, 'photos');
  fs.mkdirSync(photos);
  const browser = await chromium.launch();
  const api = start(API_PORT, photos);
  let site;
  try {
    await renderPhotos(browser, photos);
    await exportSite(path.join(work, 'dist'));
    // e2e/serve.js serves <cwd>/dist under /antiskino, like GitHub Pages.
    site = spawn(process.execPath, [path.join(ROOT, 'e2e', 'serve.js'), String(SITE_PORT)], {
      cwd: work,
      stdio: 'ignore',
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const framePage = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    for (const lang of Object.keys(CAPTIONS)) {
      fs.mkdirSync(path.join(OUT, lang), { recursive: true });
      for (const shot of SHOTS) {
        const raw = path.join(work, `${lang}-${shot.name}.png`);
        await shoot(browser, lang, shot, raw);
        await frame(
          framePage,
          raw,
          CAPTIONS[lang][shot.name],
          path.join(OUT, lang, `${shot.name}.png`),
        );
        log(`${lang}/${shot.name}.png`);
      }
    }
  } finally {
    site?.kill();
    api.close();
    await browser.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
