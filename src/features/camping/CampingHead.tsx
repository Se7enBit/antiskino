import { photoUrl } from '@/api/photos';
import { staticCamping } from '@/api/staticCampings';
import { localized, useLanguage } from '@/i18n';
import { siteUrl } from '@/lib/site';

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
  const camping = live ?? staticCamping(slug);
  if (!camping) return null;
  const description = localized(camping.shortDescr, language);
  const site = siteUrl();
  return (
    <>
      <title>{`${camping.name} · Antiskino`}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={camping.name} />
      {description ? <meta property="og:description" content={description} /> : null}
      {site ? <meta property="og:url" content={`${site}/c/${slug}`} /> : null}
      {camping.coverPhoto ? (
        <meta property="og:image" content={photoUrl(camping.coverPhoto)} />
      ) : null}
    </>
  );
}
