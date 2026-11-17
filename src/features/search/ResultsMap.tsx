import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { SearchResult } from '@/api/search';
import { pinsOf } from '@/domain/map';
import { useLanguage, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { BodyText, PinsMap, spacing } from '@/ui';

type Props = { results: SearchResult[]; onOpen: (result: SearchResult) => void };

/** The results on a map: a price pin per camping; tapping one opens it (SPEC F1). */
export function ResultsMap({ results, onOpen }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const { height } = useWindowDimensions();
  const pins = pinsOf(
    results,
    (result) => result.camping,
    (result, lat, lng) => ({
      id: result.camping.id,
      lat,
      lng,
      title: result.camping.name,
      label: formatMoney(result.fromTotalCents, language),
    }),
  );
  const missing = results.length - pins.length;
  return (
    <View style={styles.map}>
      <PinsMap
        pins={pins}
        height={Math.min(Math.max(height * 0.6, 320), 600)}
        onPress={(id) => {
          const result = results.find((r) => r.camping.id === id);
          if (result) onOpen(result);
        }}
      />
      {missing > 0 ? <BodyText>{t('search.notOnMap', { count: missing })}</BodyText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { gap: spacing.sm },
});
