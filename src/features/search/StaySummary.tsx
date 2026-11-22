import { StyleSheet, Text } from 'react-native';

import { regionName } from '@/domain/regions';
import type { SearchRequest } from '@/domain/search';
import { useLanguage, useT } from '@/i18n';
import { formatDateInput, nightsBetween } from '@/lib/dates';
import { Button, colors } from '@/ui';

/** "10/07/2027 → 12/07/2027 · nights: 2", the party and equipment, and a Change button. */
export function StaySummary({
  request,
  onChange,
}: {
  request: SearchRequest;
  onChange: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <>
      <Text style={styles.dates}>
        {formatDateInput(request.arrival)} → {formatDateInput(request.departure)} ·{' '}
        {t('search.nights', { count: nightsBetween(request.arrival, request.departure) })}
      </Text>
      <Text style={styles.muted}>
        {t('search.party', { adults: request.adults, children: request.childAges.length })} ·{' '}
        {t(`equipment.${request.equipment}`)}
        {request.region ? ` · ${regionName(request.region, language)}` : ''}
      </Text>
      <Button label={t('search.change')} icon="magnify" onPress={onChange} testID="search-change" />
    </>
  );
}

const styles = StyleSheet.create({
  dates: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
});
