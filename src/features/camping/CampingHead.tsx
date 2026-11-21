import { photoUrl } from '@/api/photos';
import { staticCamping } from '@/api/staticCampings';
import { campgroundJsonLd } from '@/domain/seo';
import { localized, LANGUAGES, type Language } from '@/i18n';
import { siteUrl } from '@/lib/site';

/**
 * The page's schema.org data travels in this meta tag: React hoists meta tags
 * without hydrating them, while an inline <script> would not match in the
 * browser. scripts/seo.js turns it into a JSON-LD script after the export.
 */
export const JSON_LD_META = 'antiskino:json-ld';

type Props = {
  slug: string;
  /** The page's language: its address, description and language links follow it. */
  pageLanguage: Language;
  live?: { name: string; shortDescr: unknown; coverPhoto: string | null };
};

/**
 * Web: title, description and og:image for the camping page. React DOM hoists
 * these tags into <head>, also in the static export, where the data comes from
 * the build-time list so shared links preview well (SPEC F2). In the browser
 * the loaded camping takes over. (expo-router/head only applies in the browser.)
 */
/** The page's address: Greek at c/<slug>/, English at en/c/<slug>/ (SPEC F2). */
function pageUrl(site: string, slug: string, language: Language): string {
  return `${site}/${language === 'en' ? 'en/' : ''}c/${slug}/`;
}

export function CampingHead({ slug, pageLanguage, live }: Props) {
  // Build-time data (the static export); null in the browser.
  const prerendered = live ? undefined : staticCamping(slug);
  const camping = live ?? prerendered;
  if (!camping) return null;
  const description = localized(camping.shortDescr, pageLanguage);
  const site = siteUrl();
  // The export writes c/<slug>/index.html, which GitHub Pages serves at c/<slug>/.
  const url = site ? pageUrl(site, slug, pageLanguage) : null;
  const image = camping.coverPhoto ? photoUrl(camping.coverPhoto) : null;
  return (
    <>
      <title>{`${camping.name} · Antiskino`}</title>
      {url ? <link rel="canonical" href={url} /> : null}
      {/* Each language's address, for search engines; Greek is the default. */}
      {site
        ? LANGUAGES.map((language) => (
            <link
              key={language}
              rel="alternate"
              hrefLang={language}
              href={pageUrl(site, slug, language)}
            />
          ))
        : null}
      {site ? <link rel="alternate" hrefLang="x-default" href={pageUrl(site, slug, 'el')} /> : null}
      {prerendered ? (
        <meta
          name={JSON_LD_META}
          content={JSON.stringify(campgroundJsonLd({ ...prerendered, description, url, image }))}
        />
      ) : null}
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={pageLanguage === 'en' ? 'en_GB' : 'el_GR'} />
      <meta property="og:title" content={camping.name} />
      {description ? <meta property="og:description" content={description} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}
    </>
  );
}
