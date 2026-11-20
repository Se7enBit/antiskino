import { photoUrl } from '@/api/photos';
import { staticCamping } from '@/api/staticCampings';
import { campgroundJsonLd } from '@/domain/seo';
import { localized, useLanguage } from '@/i18n';
import { siteUrl } from '@/lib/site';

/**
 * The page's schema.org data travels in this meta tag: React hoists meta tags
 * without hydrating them, while an inline <script> would not match in the
 * browser. scripts/seo.js turns it into a JSON-LD script after the export.
 */
export const JSON_LD_META = 'antiskino:json-ld';

type Props = {
  slug: string;
  live?: { name: string; shortDescr: unknown; coverPhoto: string | null };
};

/**
 * Web: title, description and og:image for the camping page. React DOM hoists
 * these tags into <head>, also in the static export, where the data comes from
 * the build-time list so shared links preview well (SPEC F2). In the browser
 * the loaded camping takes over. (expo-router/head only applies in the browser.)
 */
export function CampingHead({ slug, live }: Props) {
  const { language } = useLanguage();
  // Build-time data (the static export); null in the browser.
  const prerendered = live ? undefined : staticCamping(slug);
  const camping = live ?? prerendered;
  if (!camping) return null;
  const description = localized(camping.shortDescr, language);
  const site = siteUrl();
  // The export writes c/<slug>/index.html, which GitHub Pages serves at c/<slug>/.
  const url = site ? `${site}/c/${slug}/` : null;
  const image = camping.coverPhoto ? photoUrl(camping.coverPhoto) : null;
  return (
    <>
      <title>{`${camping.name} · Antiskino`}</title>
      {url ? <link rel="canonical" href={url} /> : null}
      {prerendered ? (
        <meta
          name={JSON_LD_META}
          content={JSON.stringify(campgroundJsonLd({ ...prerendered, description, url, image }))}
        />
      ) : null}
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={camping.name} />
      {description ? <meta property="og:description" content={description} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}
    </>
  );
}
