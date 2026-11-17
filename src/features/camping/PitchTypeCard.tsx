import { StyleSheet, Text, View } from 'react-native';

import type { CampingPage } from '@/api/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { Button, Icon, colors, spacing } from '@/ui';

import { EQUIPMENT_ICONS } from './icons';

/** What the price line shows: a stay total, unavailable, a from-price, or nothing yet. */
export type PitchPrice =
  | { kind: 'total'; cents: number }
  | { kind: 'unavailable' }
  | { kind: 'from'; cents: number | null }
  | { kind: 'loading' };

type Props = {
  pitchType: CampingPage['pitchTypes'][number];
  price: PitchPrice;
  /** Opens the booking flow; without it (no dates, unavailable) Book is disabled. */
  onBook?: () => void;
};

export function PitchTypeCard({ pitchType, price, onBook }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const unavailable = price.kind === 'unavailable';
  const included = localized(pitchType.included, language);
  const descr = localized(pitchType.descr, language);
  return (
    <View style={[styles.card, unavailable && styles.unavailable]} testID={`pitch-${pitchType.id}`}>
      <Text style={styles.name}>{localized(pitchType.name, language)}</Text>
      <View style={styles.facts}>
        {pitchType.accepts.map((equipment) => (
          <View key={equipment} style={styles.fact}>
            <Icon name={EQUIPMENT_ICONS[equipment]} size={18} color={colors.muted} />
            <Text style={styles.muted}>{t(`equipment.${equipment}`)}</Text>
          </View>
        ))}
        <View style={styles.fact}>
          <Icon name="account-multiple" size={18} color={colors.muted} />
          <Text style={styles.muted}>
            {t('camping.maxPeople', { count: pitchType.max_people })}
          </Text>
        </View>
        {pitchType.size_m2 ? (
          <Text style={styles.muted}>{t('camping.size', { size: pitchType.size_m2 })}</Text>
        ) : null}
      </View>
      {descr ? <Text style={styles.muted}>{descr}</Text> : null}
      {included ? (
        <Text style={styles.muted}>{t('camping.included', { items: included })}</Text>
      ) : null}
      <View style={styles.footer}>
        <Text
          style={[styles.price, unavailable && styles.muted]}
          testID={`pitch-${pitchType.id}-price`}
        >
          {price.kind === 'total'
            ? t('camping.total', { price: formatMoney(price.cents, language) })
            : price.kind === 'unavailable'
              ? t('camping.unavailable')
              : price.kind === 'from' && price.cents !== null
                ? t('camping.fromPerNight', { price: formatMoney(price.cents, language) })
                : price.kind === 'loading'
                  ? '…'
                  : ''}
        </Text>
        <Button
          label={t('camping.book')}
          variant="primary"
          onPress={() => onBook?.()}
          disabled={!onBook}
          testID={`pitch-${pitchType.id}-book`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  unavailable: { opacity: 0.55 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  muted: { fontSize: 15, color: colors.muted },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  price: { fontSize: 17, fontWeight: '700', color: colors.primary },
});
