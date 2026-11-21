import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useLiveCampings } from '@/api/search';
import { paramsFromRequest, regionsOf, withoutRegion } from '@/domain/search';
import { useLanguage, useT } from '@/i18n';
import { BodyText, Loading, Screen, colors, spacing } from '@/ui';

import { CampingPage } from '../camping/CampingPage';
import { campingPathname } from '../camping/routes';
import { PageHead } from '../common/PageHead';

import { SearchForm } from './SearchForm';

/** Home: the search form, or the camping's page when exactly one camping is live (SPEC F1). */
export function HomeScreen() {
  const t = useT();
  const { language } = useLanguage();
  const campings = useLiveCampings();
  // Not with a single camping: its page brings its own title.
  const head = <PageHead title={t('meta.home.title')} description={t('meta.home.description')} />;
  if (campings.isLoading)
    return (
      <Screen>
        {head}
        <Loading label={t('common.loading')} />
      </Screen>
    );
  const only = campings.data?.length === 1 ? campings.data[0] : undefined;
  if (only)
    return (
      <Screen>
        <CampingPage
          slug={only.slug}
          request={null}
          onSearch={(request) =>
            router.push({
              pathname: campingPathname(language),
              params: { slug: only.slug, ...paramsFromRequest(withoutRegion(request)) },
            })
          }
          onNotFound={() => void campings.refetch()}
        />
      </Screen>
    );
  return (
    <Screen>
      {head}
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          {t('search.title')}
        </Text>
        <BodyText>{t('search.subtitle')}</BodyText>
      </View>
      <SearchForm
        regions={regionsOf(campings.data ?? [])}
        onSearch={(request) =>
          router.push({ pathname: '/search', params: paramsFromRequest(request) })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
});
