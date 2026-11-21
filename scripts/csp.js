// After `expo export -p web`: a Content-Security-Policy for every page, as a
// <meta> tag at the top of <head> (GitHub Pages can't send headers).
// - Scripts: only the site's own files, plus each page's inline scripts by
//   their SHA-256 (Expo Router writes one, the hydration flag). No eval.
// - Connections: the site, the Supabase project (HTTPS and the realtime
//   WebSocket), OpenFreeMap for the map, and Sentry's ingest host when a DSN is
//   set. Images: the site, data:/blob: (photo previews) and Supabase Storage.
// - Styles allow inline: React Native Web writes its styles at runtime.
// A <meta> policy can't set frame-ancestors (clickjacking); that needs headers.
// Origins come from EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SENTRY_DSN, the
// same values the export was built with.
// Usage: node scripts/csp.js <export folder>
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_ORIGIN = 'https://tiles.openfreemap.org';

/**
 * scheme://host[:port] of a URL, or null.
 * @param {string | undefined} value
 */
function originOf(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

/** The WebSocket origin matching an http(s) origin. */
function socketOrigin(origin) {
  return origin.replace(/^http/, 'ws');
}

/**
 * Inline scripts that run (not JSON-LD or other data blocks), as CSP hashes.
 * @param {string} html
 */
function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attributes, body] = match;
    if (/\bsrc\s*=/i.test(attributes)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase();
    if (type && !['text/javascript', 'module', 'application/javascript'].includes(type)) continue;
    const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return [...new Set(hashes)];
}

/**
 * The policy for one page.
 * @param {string} html
 * @param {{ supabaseUrl?: string, sentryDsn?: string }} options
 */
function policyFor(html, { supabaseUrl, sentryDsn }) {
  const supabase = originOf(supabaseUrl);
  const sentry = originOf(sentryDsn);
  const connect = ["'self'", MAP_ORIGIN];
  if (supabase) connect.push(supabase, socketOrigin(supabase));
  if (sentry) connect.push(sentry);
  const images = ["'self'", 'data:', 'blob:', ...(supabase ? [supabase] : [])];
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * The page with its policy as the first tag in <head>.
 * @param {string} html
 * @param {{ supabaseUrl?: string, sentryDsn?: string }} options
 */
function withPolicy(html, options) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html, options)}"/>`;
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  return html.replace(/<head([^>]*)>/i, (head) => `${head}${meta}`);
}

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.name.endsWith('.html') ? [file] : [];
  });
}

function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/csp.js <export folder>');
    process.exit(1);
  }
  const options = {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  };
  const files = htmlFiles(dir);
  for (const file of files) {
    fs.writeFileSync(file, withPolicy(fs.readFileSync(file, 'utf8'), options));
  }
  process.stdout.write(`Content-Security-Policy added to ${files.length} pages.\n`);
}

if (require.main === module) main();

module.exports = { inlineScriptHashes, originOf, policyFor, withPolicy };
