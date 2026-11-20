// After `expo export -p web`: search engine files for the static site.
// - Every page: the schema.org data CampingHead leaves in a
//   <meta name="antiskino:json-ld"> becomes a JSON-LD script.
// - Production only (EXPO_PUBLIC_INDEXABLE=1): sitemap.xml and robots.txt at
//   the site's root, from EXPO_PUBLIC_SITE_URL (the preview under /preview/ is
//   left out and disallowed).
// Usage: node scripts/seo.js <export folder>
const fs = require('fs');
const path = require('path');

const META = /<meta name="antiskino:json-ld" content="([^"]*)"\s*\/?>/g;

const ENTITIES = { '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' };

function decodeAttribute(value) {
  return value.replace(/&(quot|#x27|#39|lt|gt);/g, (m) => ENTITIES[m]).replace(/&amp;/g, '&');
}

/** The page with its JSON-LD meta tag replaced by a script search engines read. */
function withJsonLd(html) {
  return html.replace(META, (_, content) => {
    const json = JSON.stringify(JSON.parse(decodeAttribute(content)))
      // Nothing in the data can close the script tag.
      .replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
  });
}

/**
 * Paths of the pages that belong in the sitemap, as GitHub Pages serves them:
 * terms.html at "terms", c/<slug>/index.html at "c/<slug>/", home at "".
 */
function sitemapPaths(htmlFiles) {
  const paths = new Set();
  for (const file of htmlFiles) {
    // Route groups like "(customer)" are copies; the canonical path has none.
    if (file.includes('(') || file.includes('[')) continue;
    const page = file
      .replace(/\\/g, '/')
      .replace(/index\.html$/, '')
      .replace(/\.html$/, '');
    if (page === '' || page === 'terms' || page === 'privacy' || /^c\/[^/]+\/$/.test(page)) {
      paths.add(page);
    }
  }
  return [...paths].sort();
}

function sitemapXml(site, paths, today) {
  const urls = paths
    .map((p) => `  <url><loc>${site}/${p}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt(site) {
  return `User-agent: *\nDisallow: /preview/\nSitemap: ${site}/sitemap.xml\n`;
}

function htmlFilesIn(root, dir = '') {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFilesIn(root, relative);
    return entry.name.endsWith('.html') ? [relative] : [];
  });
}

function run(root, env) {
  const files = htmlFilesIn(root);
  for (const file of files) {
    const full = path.join(root, file);
    const html = fs.readFileSync(full, 'utf8');
    const updated = withJsonLd(html);
    if (updated !== html) fs.writeFileSync(full, updated);
  }
  const site = (env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (env.EXPO_PUBLIC_INDEXABLE === '1' && site) {
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemapXml(site, sitemapPaths(files), today));
    fs.writeFileSync(path.join(root, 'robots.txt'), robotsTxt(site));
  }
}

module.exports = { withJsonLd, sitemapPaths, sitemapXml, robotsTxt };

if (require.main === module) {
  const root = process.argv[2];
  if (!root) {
    process.stderr.write('Usage: node scripts/seo.js <export folder>\n');
    process.exit(1);
  }
  run(root, process.env);
}
