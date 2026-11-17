import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSearch, type SearchResult } from '@/api/search';
import {
  paramsFromRequest,
  queryFromRequest,
  requestFromParams,
  withoutRegion,
  type SearchRequest,
} from '@/domain/search';
import { useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { Button, Card, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { ResultCard } from './ResultCard';
import { ResultsMap } from './ResultsMap';
import { StaySummary } from './StaySummary';
import { useSearchStore } from './searchStore';

/** /search?arrival=…: campings available for the stay (SPEC F1). */
export function ResultsScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  const request = requestFromParams(params);
  const key = JSON.stringify(request);
  const update = useSearchStore((s) => s.update);
  const hydrated = useHydrated();

  // A shared link fills in the form too, so "Change search" starts from it.
  useEffect(() => {
    if (request) update(queryFromRequest(request));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for request
  }, [key, update]);

  // The static page is built without URL parameters: render them only after hydration.
  if (!hydrated) return <Loading label={t('search.searching')} />;
  if (!request)
    return (
      <Screen>
        <Notice message={t('search.badLink')} />
        <Button
          label={t('search.newSearch')}
          variant="primary"
          onPress={() => router.navigate('/')}
        />
      </Screen>
    );
  return (
    <Screen>
      <Card>
        <StaySummary request={request} onChange={() => router.navigate('/')} />
      </Card>
      <Results request={request} />
    </Screen>
  );
}

function Results({ request }: { request: SearchRequest }) {
  const t = useT();
  const search = useSearch(request);
  const [view, setView] = useState<'list' | 'map'>('list');
  if (search.isPending) return <Loading label={t('search.searching')} />;
  if (search.isError)
    return (
      <View style={styles.list}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void search.refetch()} />
      </View>
    );
  const { results } = search.data;
  if (results.length === 0) return <Notice message={t('search.noResults')} />;
  const open = (result: SearchResult) =>
    router.push({
      pathname: '/c/[slug]',
      params: { slug: result.camping.slug, ...paramsFromRequest(withoutRegion(request)) },
    });
  return (
    <View style={styles.list}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('search.results')}
        </Text>
        <View style={styles.toggle}>
          <Button
            label={t('search.list')}
            icon="format-list-bulleted"
            selected={view === 'list'}
            onPress={() => setView('list')}
            testID="results-list"
          />
          <Button
            label={t('search.map')}
            icon="map"
            selected={view === 'map'}
            onPress={() => setView('map')}
            testID="results-map"
          />
        </View>
      </View>
      {view === 'map' ? (
        <ResultsMap results={results} onOpen={open} />
      ) : (
        results.map((result) => (
          <ResultCard key={result.camping.id} result={result} onOpen={() => open(result)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toggle: { flexDirection: 'row', gap: spacing.sm },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
});
