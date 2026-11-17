import { Image, StyleSheet, Text, View } from 'react-native';

import { photoUrl } from '@/api/photos';
import type { SearchResult } from '@/api/search';
import { localized, useLanguage, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { Icon, colors, spacing } from '@/ui';

/** A camping in the results: photo, name, place, short text and "from €X total". */
export function ResultCard({ result }: { result: SearchResult }) {
  const t = useT();
  const { language } = useLanguage();
  const { camping } = result;
  const shortDescr = localized(camping.shortDescr, language);
  return (
    <View style={styles.card} testID={`result-${camping.slug}`}>
      {camping.coverPhoto ? (
        <Image
          source={{ uri: photoUrl(camping.coverPhoto) }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Icon name="tent" size={40} color={colors.muted} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} accessibilityRole="header">
          {camping.name}
        </Text>
        {camping.region ? (
          <View style={styles.place}>
            <Icon name="map-marker" size={16} color={colors.muted} />
            <Text style={styles.muted}>{camping.region}</Text>
          </View>
        ) : null}
        {shortDescr ? (
          <Text style={styles.muted} numberOfLines={2}>
            {shortDescr}
          </Text>
        ) : null}
        <Text style={styles.price}>
          {t('search.from', { price: formatMoney(result.fromTotalCents, language) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.xs, padding: spacing.md },
  name: { fontSize: 19, fontWeight: '700', color: colors.text },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  muted: { fontSize: 15, color: colors.muted },
  price: { fontSize: 17, fontWeight: '700', color: colors.primary, marginTop: spacing.xs },
});
