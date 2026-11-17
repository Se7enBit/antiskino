import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCampingPage } from '@/api/camping';
import { useSearch } from '@/api/search';
import { bookingParams } from '@/domain/booking';
import { pitchFromCents } from '@/domain/camping';
import { queryFromRequest, type SearchRequest } from '@/domain/search';
import { localized, useLanguage, useT } from '@/i18n';
import { todayInAthens } from '@/lib/dates';
import { useHydrated } from '@/lib/useHydrated';
import { BodyText, Button, Card, Icon, Loading, Notice, colors, spacing } from '@/ui';

import { SearchForm } from '../search/SearchForm';
import { useSearchStore } from '../search/searchStore';
import { StaySummary } from '../search/StaySummary';

import { CampingDetails } from './CampingDetails';
import { CampingHead } from './CampingHead';
import { Gallery } from './Gallery';
import { PitchTypeCard, type PitchPrice } from './PitchTypeCard';

type Props = {
  slug: string | undefined;
  /** The stay to price, or null for "from" prices. */
  request: SearchRequest | null;
  onSearch: (request: SearchRequest) => void;
  onNotFound: () => void;
};

/** A camping's page (SPEC F2): gallery, availability and totals for the stay, details. */
export function CampingPage({ slug, request, onSearch, onNotFound }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const hydrated = useHydrated();
  const page = useCampingPage(slug);
  const camping = page.data;
  const availability = useSearch(camping && request ? { ...request, campingId: camping.id } : null);
  const [changing, setChanging] = useState(false);
  const update = useSearchStore((s) => s.update);
  const key = JSON.stringify(request);

  // Keep the search form in step with the stay shown.
  useEffect(() => {
    if (request) update(queryFromRequest(request));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for request
  }, [key, update]);

  const head = slug ? (
    <CampingHead
      slug={slug}
      live={
        camping
          ? {
              name: camping.name,
              shortDescr: camping.short_descr,
              coverPhoto: camping.photos[0] ?? null,
            }
          : undefined
      }
    />
  ) : null;

  if (!hydrated || page.isPending)
    return (
      <>
        {head}
        <Loading label={t('common.loading')} />
      </>
    );
  if (page.isError)
    return (
      <View style={styles.page}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void page.refetch()} />
      </View>
    );
  if (!camping)
    return (
      <View style={styles.page}>
        <Notice message={t('camping.notFound')} />
        <Button label={t('search.newSearch')} variant="primary" onPress={onNotFound} />
      </View>
    );

  const today = todayInAthens();
  const sellable = availability.data?.results[0]?.pitchTypes ?? [];
  const priceOf = (pitchTypeId: string): PitchPrice => {
    if (!request)
      return {
        kind: 'from',
        cents: pitchFromCents(pitchTypeId, camping.seasons, camping.pitchPrices, today),
      };
    if (availability.isPending || availability.isError) return { kind: 'loading' };
    const found = sellable.find((p) => p.id === pitchTypeId);
    return found ? { kind: 'total', cents: found.totalCents } : { kind: 'unavailable' };
  };
  const shortDescr = localized(camping.short_descr, language);

  return (
    <View style={styles.page}>
      {head}
      <Stack.Screen options={{ title: camping.name }} />
      {camping.status !== 'live' ? <Notice message={t('camping.draft')} /> : null}
      <Gallery photos={camping.photos} />
      <View style={styles.intro}>
        <Text style={styles.name} accessibilityRole="header">
          {camping.name}
        </Text>
        {camping.region ? (
          <View style={styles.place}>
            <Icon name="map-marker" size={18} color={colors.muted} />
            <BodyText>{camping.region}</BodyText>
          </View>
        ) : null}
        {shortDescr ? <BodyText>{shortDescr}</BodyText> : null}
      </View>

      <Card title={request ? t('camping.yourStay') : t('camping.checkAvailability')}>
        {request && !changing ? (
          <StaySummary request={request} onChange={() => setChanging(true)} />
        ) : (
          <SearchForm
            regions={[]}
            onSearch={(next) => {
              setChanging(false);
              onSearch(next);
            }}
          />
        )}
      </Card>

      <Text style={styles.heading} accessibilityRole="header">
        {t('camping.pitchTypes')}
      </Text>
      {availability.isError ? (
        <View style={styles.page}>
          <Notice tone="error" message={t('common.error')} />
          <Button label={t('common.retry')} onPress={() => void availability.refetch()} />
        </View>
      ) : null}
      {!request ? <BodyText>{t('camping.noPrice')}</BodyText> : null}
      {camping.pitchTypes.map((pitchType) => {
        const price = priceOf(pitchType.id);
        return (
          <PitchTypeCard
            key={pitchType.id}
            pitchType={pitchType}
            price={price}
            onBook={
              request && price.kind === 'total'
                ? () =>
                    router.push({
                      pathname: '/book',
                      params: bookingParams({ pitchTypeId: pitchType.id, stay: request }),
                    })
                : undefined
            }
          />
        );
      })}
      <CampingDetails camping={camping} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  intro: { gap: spacing.xs },
  name: { fontSize: 28, fontWeight: '800', color: colors.text },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
});
