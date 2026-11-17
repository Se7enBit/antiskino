import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSearch } from '@/api/search';
import { queryFromRequest, requestFromParams, type SearchRequest } from '@/domain/search';
import { useT } from '@/i18n';
import { formatDateInput, nightsBetween } from '@/lib/dates';
import { useHydrated } from '@/lib/useHydrated';
import { Button, Card, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { ResultCard } from './ResultCard';
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
      <Summary request={request} />
      <Results request={request} />
    </Screen>
  );
}

function Summary({ request }: { request: SearchRequest }) {
  const t = useT();
  return (
    <Card>
      <Text style={styles.summary}>
        {formatDateInput(request.arrival)} → {formatDateInput(request.departure)} ·{' '}
        {t('search.nights', { count: nightsBetween(request.arrival, request.departure) })}
      </Text>
      <Text style={styles.muted}>
        {t('search.party', { adults: request.adults, children: request.childAges.length })} ·{' '}
        {t(`equipment.${request.equipment}`)}
        {request.region ? ` · ${request.region}` : ''}
      </Text>
      <Button
        label={t('search.change')}
        icon="magnify"
        onPress={() => router.navigate('/')}
        testID="search-change"
      />
    </Card>
  );
}

function Results({ request }: { request: SearchRequest }) {
  const t = useT();
  const search = useSearch(request);
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
  return (
    <View style={styles.list}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('search.results')}
      </Text>
      {results.map((result) => (
        <ResultCard key={result.camping.id} result={result} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  summary: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
});
