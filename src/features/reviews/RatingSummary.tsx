import { StyleSheet, Text, View } from 'react-native';

import { formatRating, shownRating, type Rating } from '@/domain/reviews';
import { useLanguage, useT } from '@/i18n';
import { Icon, colors, spacing } from '@/ui';

/** "★ 4.6 · reviews: 12", only from 3 reviews (SPEC F9). */
export function RatingSummary({
  rating,
  size = 16,
}: {
  rating: Rating | null | undefined;
  size?: number;
}) {
  const t = useT();
  const { language } = useLanguage();
  const shown = shownRating(rating);
  if (!shown) return null;
  const label = t('reviews.summary', {
    average: formatRating(shown.average, language),
    count: shown.count,
  });
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Icon name="star" size={size} color="#F5A623" />
      <Text style={[styles.text, { fontSize: size }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { fontWeight: '700', color: colors.text },
});
