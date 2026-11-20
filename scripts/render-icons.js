// Draws the Antiskino logo (a tent with a sun over the sea) and renders every
// icon and store image from it, plus the editable SVGs in assets/logo/.
// Uses the Playwright + Chromium preinstalled in cloud sessions (not a project
// dependency). Run from the repo root: node scripts/render-icons.js .
// Optional second argument: a folder for a preview sheet (sheet.png).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const repo = process.argv[2];
const previewDir = process.argv[3];
const GREEN = '#1F6F4A';
const GREEN_TOP = '#25845A';
const GREEN_BOTTOM = '#185C3D';
const SUN = '#F4C95D';
const SEA = '#9ED8F0';

/** The mark on a 1024 canvas: tent (door cut out), poles, sun, sea. */
function mark({ color = '#FFFFFF', sun = SUN, sea = SEA, id = 'm' } = {}) {
  return `
  <mask id="door-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
    <rect width="1024" height="1024" fill="#fff"/>
    <path d="M512 486 L598 762 L426 762 Z" fill="#000"/>
  </mask>
  <g mask="url(#door-${id})">
    <path d="M512 280 L788 742 L236 742 Z" fill="${color}" stroke="${color}" stroke-width="36" stroke-linejoin="round"/>
  </g>
  <path d="M512 290 L552 222 M512 290 L472 222" stroke="${color}" stroke-width="30" stroke-linecap="round"/>
  <circle cx="752" cy="300" r="74" fill="${sun}"/>
  <path d="M212 816 q50 -26 100 0 t100 0 t100 0 t100 0 t100 0 t100 0" fill="none" stroke="${sea}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const background = (w, h, id = 'bg') => `
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${GREEN_TOP}"/><stop offset="1" stop-color="${GREEN_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>`;

const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

// Android adaptive icons show only a circle of about 61% of the canvas: shrink the mark into it.
const safe = (body) =>
  `<g transform="translate(512 512) scale(0.72) translate(-512 -512)">${body}</g>`;

const icon = svg(1024, 1024, background(1024, 1024) + mark());
const roundedIcon = svg(
  1024,
  1024,
  `<clipPath id="r"><rect width="1024" height="1024" rx="224"/></clipPath><g clip-path="url(#r)">${background(1024, 1024)}${mark()}</g>`,
);

function banner(title, tagline) {
  return svg(
    1024,
    500,
    `${background(1024, 500, 'fg')}
     <g transform="translate(30 -12) scale(0.5)">${mark({ id: 'b' })}</g>
     <text x="512" y="226" font-family="Inter" font-weight="800" font-size="86" fill="#fff">${title}</text>
     <text x="515" y="290" font-family="Inter" font-weight="500" font-size="30" fill="#DDEFE5">${tagline[0]}</text>
     <text x="515" y="330" font-family="Inter" font-weight="500" font-size="30" fill="#DDEFE5">${tagline[1]}</text>`,
  );
}

const outputs = [
  ['assets/icon.png', 1024, 1024, icon],
  ['assets/android-icon-foreground.png', 1024, 1024, svg(1024, 1024, safe(mark()))],
  ['assets/android-icon-background.png', 1024, 1024, svg(1024, 1024, background(1024, 1024))],
  [
    'assets/android-icon-monochrome.png',
    1024,
    1024,
    svg(1024, 1024, safe(mark({ color: '#fff', sun: '#fff', sea: '#fff' }))),
  ],
  ['assets/splash-icon.png', 1024, 1024, svg(1024, 1024, mark({ color: GREEN, sea: '#4FA3C7' }))],
  [
    'assets/favicon.png',
    48,
    48,
    svg(48, 48, roundedIcon.replace(/^<svg[^>]*>|<\/svg>$/g, ''), '0 0 1024 1024'),
  ],
  [
    'assets/store/play-icon-512.png',
    512,
    512,
    svg(512, 512, icon.replace(/^<svg[^>]*>|<\/svg>$/g, ''), '0 0 1024 1024'),
  ],
  [
    'assets/store/feature-graphic-en.png',
    1024,
    500,
    banner('Antiskino', ['Camping pitches in Greece,', 'booked in a minute']),
  ],
  [
    'assets/store/feature-graphic-el.png',
    1024,
    500,
    banner('Antiskino', ['Θέσεις κάμπινγκ στην Ελλάδα,', 'κράτηση σε ένα λεπτό']),
  ],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, w, h, source] of outputs) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${source}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const target = path.join(repo, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({
      path: target,
      omitBackground: true,
      clip: { x: 0, y: 0, width: w, height: h },
    });
    process.stdout.write(`wrote ${file}\n`);
  }
  // Editable sources
  fs.mkdirSync(path.join(repo, 'assets/logo'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'assets/logo/icon.svg'), icon + '\n');
  fs.writeFileSync(path.join(repo, 'assets/logo/mark.svg'), svg(1024, 1024, mark()) + '\n');
  if (previewDir) {
    // One sheet to look at: icon, round mask, Android shapes, favicon, banners.
    await page.setViewportSize({ width: 1100, height: 1300 });
    const img = (f) =>
      'data:image/png;base64,' + fs.readFileSync(path.join(repo, f)).toString('base64');
    await page.setContent(`<html><body style="margin:20px;background:#eee;font:14px Inter">
      <div style="display:flex;gap:24px;align-items:center">
        <img src="${img('assets/icon.png')}" width="200" style="border-radius:44px">
        <div style="width:200px;height:200px;border-radius:50%;overflow:hidden;position:relative">
          <img src="${img('assets/android-icon-background.png')}" width="200" style="position:absolute">
          <img src="${img('assets/android-icon-foreground.png')}" width="200" style="position:absolute"></div>
        <div style="width:200px;height:200px;border-radius:50%;background:#333;overflow:hidden">
          <img src="${img('assets/android-icon-monochrome.png')}" width="200"></div>
        <img src="${img('assets/favicon.png')}" width="48"><img src="${img('assets/favicon.png')}" width="16">
        <img src="${img('assets/icon.png')}" width="48" style="border-radius:12px">
      </div>
      <div style="margin-top:20px;display:flex;gap:20px"><img src="${img('assets/splash-icon.png')}" width="200" style="background:#fff"></div>
      <img src="${img('assets/store/feature-graphic-en.png')}" width="1024" style="margin-top:20px;display:block">
      <img src="${img('assets/store/feature-graphic-el.png')}" width="1024" style="margin-top:20px;display:block">
      </body></html>`);
    await page.screenshot({ path: path.join(previewDir, 'sheet.png'), fullPage: true });
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
