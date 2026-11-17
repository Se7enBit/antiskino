import { StyleSheet, View } from 'react-native';

import type { BookingContext, QuoteResponse } from '@/api/booking';
import { partyByCategory, type BookingTarget } from '@/domain/booking';
import { localized, useLanguage, useT } from '@/i18n';
import { nightsBetween } from '@/lib/dates';
import { BodyText, Button, Card, Loading, Notice, Stepper, spacing } from '@/ui';

import { PriceBreakdown, type ItemNames } from './PriceBreakdown';

type Props = {
  context: BookingContext;
  target: BookingTarget;
  quote: QuoteResponse | undefined;
  quoteFailed: boolean;
  names: ItemNames;
  extras: Record<string, number>;
  onExtra: (id: string, quantity: number) => void;
  onBack: () => void;
  onContinue: () => void;
};

/** Step 1: the party by the camping's categories, extras and the live price. */
export function StayStep(props: Props) {
  const { context, target, quote, quoteFailed, names, extras, onExtra, onBack, onContinue } = props;
  const t = useT();
  const { language } = useLanguage();
  const party = partyByCategory(context.guestCategories, target.stay);
  const offered = quote?.available
    ? context.extras.filter((e) => quote.offeredExtras.includes(e.id))
    : [];

  if (!party)
    return (
      <View style={styles.step}>
        <Notice tone="error" message={t('booking.noCategory')} />
        <Button label={t('booking.back')} onPress={onBack} />
      </View>
    );

  return (
    <View style={styles.step}>
      <Card title={t('booking.guests')}>
        {party.map(({ id, count }) => (
          <BodyText key={id}>
            {t('booking.guestCount', { name: localized(names.guest[id], language), count })}
          </BodyText>
        ))}
      </Card>

      <Card title={t('booking.extras')}>
        {offered.length === 0 ? <BodyText>{t('booking.noExtras')}</BodyText> : null}
        {offered.map((extra) => (
          <Stepper
            key={extra.id}
            label={`${localized(extra.name, language)} · ${t(`partner.rates.units.${extra.unit}`)}`}
            value={extras[extra.id] ?? 0}
            min={0}
            max={extra.max_qty}
            onChange={(quantity) => onExtra(extra.id, quantity)}
            decreaseLabel={t('search.fewer')}
            increaseLabel={t('search.more')}
            testID={`extra-${extra.id}`}
          />
        ))}
      </Card>

      <Card title={t('booking.price')}>
        {quoteFailed ? <Notice tone="error" message={t('common.error')} /> : null}
        {!quote && !quoteFailed ? <Loading label={t('booking.pricing')} /> : null}
        {quote && !quote.available ? (
          <Notice tone="error" message={t(`booking.unavailable.${quote.reason}`)} />
        ) : null}
        {quote?.available ? (
          <PriceBreakdown
            quote={quote.quote}
            names={names}
            nights={nightsBetween(target.stay.arrival, target.stay.departure)}
          />
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button label={t('booking.back')} onPress={onBack} />
        <Button
          label={t('booking.continue')}
          variant="primary"
          onPress={onContinue}
          disabled={!quote?.available}
          testID="booking-continue"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.md },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
