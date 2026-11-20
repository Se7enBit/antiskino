import { robotsTxt, sitemapPaths, sitemapXml, withJsonLd } from '../seo';

describe('seo post-export step', () => {
  it('turns the JSON-LD meta tag into a script that cannot be closed early', () => {
    const html =
      '<head><meta name="antiskino:json-ld" content="{&quot;name&quot;:&quot;A &amp; B &lt;/script&gt;&quot;}"/></head>';
    expect(withJsonLd(html)).toBe(
      '<head><script type="application/ld+json">{"name":"A & B \\u003c/script>"}</script></head>',
    );
  });

  it('lists home, the legal pages and each camping, without route-group copies', () => {
    expect(
      sitemapPaths([
        'index.html',
        'terms.html',
        'privacy.html',
        'search.html',
        'c/[slug].html',
        'c/demo-thalassa/index.html',
        '(customer)/c/demo-thalassa/index.html',
        'partner/index.html',
      ]),
    ).toEqual(['', 'c/demo-thalassa/', 'privacy', 'terms']);
  });

  it('writes the sitemap and robots.txt for the site', () => {
    expect(sitemapXml('https://antiskino.gr', ['', 'terms'], '2026-11-20')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url><loc>https://antiskino.gr/</loc><lastmod>2026-11-20</lastmod></url>\n' +
        '  <url><loc>https://antiskino.gr/terms</loc><lastmod>2026-11-20</lastmod></url>\n' +
        '</urlset>\n',
    );
    expect(robotsTxt('https://antiskino.gr')).toBe(
      'User-agent: *\nDisallow: /preview/\nSitemap: https://antiskino.gr/sitemap.xml\n',
    );
  });
});
