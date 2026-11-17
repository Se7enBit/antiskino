import { StyleSheet, View } from 'react-native';

import type { BookingContext, QuoteResponse } from '@/api/booking';
import {
  COUNTRIES,
  partyByCategory,
  type BookingTarget,
  type GuestDetails,
} from '@/domain/booking';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput, nightsBetween } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { BodyText, Button, Card, Checkbox, Notice, spacing } from '@/ui';

import { PriceBreakdown, type ItemNames } from './PriceBreakdown';

const isListedCountry = (code: string): code is (typeof COUNTRIES)[number] =>
  (COUNTRIES as readonly string[]).includes(code);

type Props = {
  context: BookingContext;
  target: BookingTarget;
  quote: Extract<QuoteResponse, { available: true }>;
  names: ItemNames;
  guest: GuestDetails;
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
  /** Pressed Book without accepting the terms. */
  termsMissing: boolean;
  failed: boolean;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

/** Step 3: everything once more, the terms in plain words, then Book or Send request. */
export function ReviewStep(props: Props) {
  const {
    context,
    target,
    quote,
    names,
    guest,
    accepted,
    onAccept,
    termsMissing,
    failed,
    submitting,
  } = props;
  const t = useT();
  const { language } = useLanguage();
  const { stay } = target;
  const nights = nightsBetween(stay.arrival, stay.departure);
  const request = context.camping.confirmationMode === 'request';
  const total = formatMoney(quote.quote.totalCents, language);
  const countryName = (code: string) => (isListedCountry(code) ? t(`countries.${code}`) : code);

  return (
    <View style={styles.step}>
      <Card title={`${context.camping.name} · ${localized(context.pitchType.name, language)}`}>
        <BodyText>
          {formatDateInput(stay.arrival)} → {formatDateInput(stay.departure)} ·{' '}
          {t('search.nights', { count: nights })}
        </BodyText>
        <BodyText>
          {(partyByCategory(context.guestCategories, stay) ?? [])
            .map(({ id, count }) =>
              t('booking.guestCount', { name: localized(names.guest[id], language), count }),
            )
            .join(' · ')}{' '}
          · {t(`equipment.${stay.equipment}`)}
        </BodyText>
        <PriceBreakdown quote={quote.quote} names={names} nights={nights} />
      </Card>

      <Card title={t('booking.steps.details')}>
        <BodyText>{guest.name}</BodyText>
        <BodyText>{guest.email}</BodyText>
        <BodyText>
          {guest.phone} · {countryName(guest.country)}
        </BodyText>
      </Card>

      <Card title={t('booking.review.payment')}>
        <BodyText>{t('booking.review.payOnSite', { price: total })}</BodyText>
        {request ? (
          <BodyText>
            {t('booking.review.request', { hours: context.camping.requestExpiryHours })}
          </BodyText>
        ) : null}
      </Card>

      <Card title={t('booking.review.cancellation')}>
        <BodyText>{t(`camping.cancellation.${context.camping.cancellationPolicy}`)}</BodyText>
        {context.camping.paymentMode === 'on_site' ? (
          <BodyText>{t('camping.onSiteFree')}</BodyText>
        ) : null}
      </Card>

      <Checkbox
        label={t('booking.review.terms')}
        checked={accepted}
        onChange={onAccept}
        testID="booking-terms"
      />
      {termsMissing && !accepted ? (
        <Notice tone="error" message={t('booking.review.termsRequired')} />
      ) : null}
      {failed ? <Notice tone="error" message={t('common.error')} /> : null}

      <View style={styles.actions}>
        <Button label={t('booking.back')} onPress={props.onBack} disabled={submitting} />
        <Button
          label={request ? t('booking.review.sendRequest') : t('booking.review.book')}
          variant="primary"
          onPress={props.onSubmit}
          loading={submitting}
          testID="booking-submit"
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
