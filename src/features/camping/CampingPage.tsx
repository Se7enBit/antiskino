import { Link, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useCampingPage } from '@/api/camping';
import { useCampingReviews } from '@/api/reviews';
import { useSearch } from '@/api/search';
import { bookingParams } from '@/domain/booking';
import { pitchFromCents } from '@/domain/camping';
import { regionName } from '@/domain/regions';
import { paramsFromRequest, queryFromRequest, type SearchRequest } from '@/domain/search';
import { localized, otherLanguage, useLanguage, useT, type Language } from '@/i18n';
import { todayInAthens } from '@/lib/dates';
import { useHydrated } from '@/lib/useHydrated';
import { BodyText, Button, Card, Icon, Loading, Notice, colors, spacing } from '@/ui';

import { FavoriteButton } from '../favorites/FavoriteButton';
import { RatingSummary } from '../reviews/RatingSummary';
import { SearchForm } from '../search/SearchForm';
import { useSearchStore } from '../search/searchStore';
import { StaySummary } from '../search/StaySummary';

import { CampingDetails } from './CampingDetails';
import { CampingHead } from './CampingHead';
import { CampingReviews } from './CampingReviews';
import { Gallery } from './Gallery';
import { PitchTypeCard, type PitchPrice } from './PitchTypeCard';
import { campingPathname } from './routes';

type Props = {
  slug: string | undefined;
  /** The language of the page's address (camping pages); none in single-camping Home. */
  pageLanguage?: Language;
  /** The stay to price, or null for "from" prices. */
  request: SearchRequest | null;
  onSearch: (request: SearchRequest) => void;
  onNotFound: () => void;
};

/** A camping's page (SPEC F2): gallery, availability and totals for the stay, details. */
export function CampingPage({ slug, pageLanguage, request, onSearch, onNotFound }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const hydrated = useHydrated();
  const page = useCampingPage(slug);
  const camping = page.data;
  const availability = useSearch(camping && request ? { ...request, campingId: camping.id } : null);
  const reviews = useCampingReviews(camping?.id);
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
      pageLanguage={pageLanguage ?? language}
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
        <View style={styles.title}>
          <Text style={styles.name} accessibilityRole="header">
            {camping.name}
          </Text>
          {camping.status === 'live' ? (
            <FavoriteButton campingId={camping.id} name={camping.name} />
          ) : null}
        </View>
        {camping.region ? (
          <View style={styles.place}>
            <Icon name="map-marker" size={18} color={colors.muted} />
            <BodyText>{regionName(camping.region, language)}</BodyText>
          </View>
        ) : null}
        <RatingSummary rating={reviews.data?.rating} />
        {shortDescr ? <BodyText>{shortDescr}</BodyText> : null}
        {/* Web: the same page in the other language (its own address). */}
        {pageLanguage && Platform.OS === 'web' ? (
          <Link
            replace
            href={{
              pathname: campingPathname(otherLanguage(pageLanguage)),
              params: { slug: camping.slug, ...(request ? paramsFromRequest(request) : {}) },
            }}
            accessibilityLabel={t('camping.otherLanguageLabel')}
            style={styles.otherLanguage}
            testID="camping-other-language"
          >
            {t('camping.otherLanguage')}
          </Link>
        ) : null}
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
      <CampingReviews campingId={camping.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  intro: { gap: spacing.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: 28, fontWeight: '800', color: colors.text },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  otherLanguage: {
    alignSelf: 'flex-start',
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
});
