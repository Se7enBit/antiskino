import { router, useLocalSearchParams } from 'expo-router';

import { paramsFromRequest, requestFromParams, withoutRegion } from '@/domain/search';
import { Screen } from '@/ui';

import { CampingPage } from './CampingPage';

/** /c/[slug]?arrival=…: a camping's page, priced for the stay in the URL when there is one. */
export function CampingScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const request = requestFromParams(params);
  return (
    <Screen>
      <CampingPage
        slug={slug}
        request={request && withoutRegion(request)}
        onSearch={(next) =>
          slug &&
          router.replace({
            pathname: '/c/[slug]',
            params: { slug, ...paramsFromRequest(withoutRegion(next)) },
          })
        }
        onNotFound={() => router.navigate('/')}
      />
    </Screen>
  );
}
