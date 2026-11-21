import { router, useLocalSearchParams } from 'expo-router';

import { paramsFromRequest, requestFromParams, withoutRegion } from '@/domain/search';
import type { Language } from '@/i18n';
import { Screen } from '@/ui';

import { CampingPage } from './CampingPage';
import { campingPathname } from './routes';

/**
 * /c/[slug] (Greek) and /en/c/[slug] (English): a camping's page, priced for
 * the stay in the URL when there is one.
 */
export function CampingScreen({ language }: { language: Language }) {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const request = requestFromParams(params);
  return (
    <Screen>
      <CampingPage
        slug={slug}
        pageLanguage={language}
        request={request && withoutRegion(request)}
        onSearch={(next) =>
          slug &&
          router.replace({
            pathname: campingPathname(language),
            params: { slug, ...paramsFromRequest(withoutRegion(next)) },
          })
        }
        onNotFound={() => router.navigate('/')}
      />
    </Screen>
  );
}
