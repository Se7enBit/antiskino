import { StyleSheet, Text, View } from 'react-native';

import type { QuoteResponse } from '@/api/booking';
import { lineLabel } from '@/domain/booking';
import { localized, useLanguage, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { colors, spacing } from '@/ui';

type Quote = Extract<QuoteResponse, { available: true }>['quote'];

/** Names of the priced items, jsonb {"el", "en"}. */
export type ItemNames = {
  pitch: unknown;
  guest: Record<string, unknown>;
  extra: Record<string, unknown>;
  fee: Record<string, unknown>;
};

/** One line per priced item, then the total (SPEC F3). */
export function PriceBreakdown({
  quote,
  names,
  nights,
}: {
  quote: Quote;
  names: ItemNames;
  nights: number;
}) {
  const t = useT();
  const { language } = useLanguage();
  const nameOf = (kind: string, id: string) =>
    localized(
      kind === 'pitch' ? names.pitch : names[kind as 'guest' | 'extra' | 'fee'][id],
      language,
    );

  return (
    <View style={styles.list}>
      {quote.lines.map((line) => {
        const label = lineLabel(line, nights);
        const name = nameOf(label.kind, label.id);
        const text =
          label.nights === null
            ? t('booking.lines.perStay', { name, count: label.quantity })
            : label.kind === 'pitch'
              ? t('booking.lines.nights', { name, nights: label.nights })
              : t('booking.lines.perNight', { name, count: label.quantity, nights: label.nights });
        return (
          <View key={`${line.kind}:${line.id}`} style={styles.row}>
            <Text style={styles.label}>{text}</Text>
            <Text style={styles.amount}>{formatMoney(line.totalCents, language)}</Text>
          </View>
        );
      })}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.total}>{t('booking.total')}</Text>
        <Text style={styles.total} testID="booking-total">
          {formatMoney(quote.totalCents, language)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1, fontSize: 15, color: colors.text },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: { fontSize: 17, fontWeight: '700', color: colors.text },
});
