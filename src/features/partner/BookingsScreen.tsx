import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useCampingBookings,
  usePartnerBookingAction,
  type CampingBooking,
} from '@/api/partnerBookings';
import {
  STATUS_FILTERS,
  defaultRange,
  filterBookings,
  parseRange,
  type StatusFilter,
} from '@/domain/partnerBookings';
import { useT } from '@/i18n';
import { todayInAthens } from '@/lib/dates';
import { BodyText, Button, Card, ChoiceGroup, Loading, Notice, TextField, spacing } from '@/ui';

import { BookingCard } from './bookings/BookingCard';
import { PartnerScreen } from './PartnerScreen';

export function BookingsScreen() {
  return <PartnerScreen>{({ camping }) => <BookingsBody campingId={camping.id} />}</PartnerScreen>;
}

/**
 * Requests first, then upcoming stays; past and cancelled ones on demand.
 * Search, a status filter and a date range turn it into one list of matches (SPEC F11).
 */
function BookingsBody({ campingId }: { campingId: string }) {
  const t = useT();
  const today = todayInAthens();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const parsed = parseRange(fromText, toText, today);
  const range = 'range' in parsed ? parsed.range : defaultRange(today);
  const bookings = useCampingBookings(campingId, range);
  const action = usePartnerBookingAction();
  const filtering =
    text.trim() !== '' || status !== 'all' || fromText.trim() !== '' || toText.trim() !== '';

  const clearFilters = () => {
    setText('');
    setStatus('all');
    setFromText('');
    setToText('');
  };

  const card = (booking: CampingBooking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      today={today}
      busy={action.isPending && action.variables?.bookingId === booking.id}
      failed={action.isError && action.variables?.bookingId === booking.id}
      onAction={(kind, reason) => action.mutate({ bookingId: booking.id, action: kind, reason })}
    />
  );

  const filters = (
    <View style={styles.filters}>
      <TextField
        label={t('partner.bookings.filter.search')}
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        testID="booking-search"
      />
      <View style={styles.row}>
        <Button
          label={
            showFilters ? t('partner.bookings.filter.hide') : t('partner.bookings.filter.show')
          }
          icon="filter-variant"
          onPress={() => setShowFilters((shown) => !shown)}
          testID="toggle-filters"
        />
        {filtering ? (
          <Button label={t('partner.bookings.filter.clear')} onPress={clearFilters} />
        ) : null}
      </View>
      {showFilters ? (
        <>
          <ChoiceGroup
            options={STATUS_FILTERS.map((value) => ({
              value,
              label: t(`partner.bookings.filter.status.${value}`),
            }))}
            selected={status}
            onChange={setStatus}
            testID="status-filter"
          />
          <View style={styles.row}>
            <View style={styles.date}>
              <TextField
                label={t('partner.bookings.filter.from')}
                value={fromText}
                onChangeText={setFromText}
                inputMode="numeric"
                error={
                  'error' in parsed && parsed.error === 'from'
                    ? t('partner.bookings.filter.dateError')
                    : null
                }
                testID="range-from"
              />
            </View>
            <View style={styles.date}>
              <TextField
                label={t('partner.bookings.filter.to')}
                value={toText}
                onChangeText={setToText}
                inputMode="numeric"
                error={
                  'error' in parsed && parsed.error === 'to'
                    ? t('partner.bookings.filter.dateError')
                    : null
                }
                testID="range-to"
              />
            </View>
          </View>
          <BodyText>{t('partner.bookings.filter.rangeHint')}</BodyText>
        </>
      ) : null}
    </View>
  );

  let body;
  if (bookings.isPending) body = <Loading label={t('common.loading')} />;
  else if (bookings.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void bookings.refetch()} />
      </>
    );
  else if (filtering) {
    const matches = filterBookings(bookings.data, { status, text });
    body = (
      <Card title={t('partner.bookings.filter.count', { count: matches.length })}>
        {matches.length ? (
          <View style={styles.list}>{matches.map(card)}</View>
        ) : (
          <BodyText>{t('partner.bookings.filter.none')}</BodyText>
        )}
      </Card>
    );
  } else {
    const all = bookings.data;
    const requests = all.filter((b) => b.status === 'requested');
    const upcoming = all.filter(
      (b) => ['confirmed', 'checked_in'].includes(b.status) && b.departure >= today,
    );
    const past = all.filter((b) => !requests.includes(b) && !upcoming.includes(b)).reverse();
    body = (
      <>
        {all.length === 0 ? <Notice message={t('partner.bookings.empty')} /> : null}
        {requests.length ? (
          <Card title={t('partner.bookings.requests')}>
            <View style={styles.list}>{requests.map(card)}</View>
          </Card>
        ) : null}
        {upcoming.length ? (
          <Card title={t('partner.bookings.upcoming')}>
            <View style={styles.list}>{upcoming.map(card)}</View>
          </Card>
        ) : null}
        {past.length ? (
          <>
            <Button
              label={showPast ? t('partner.bookings.hidePast') : t('partner.bookings.showPast')}
              onPress={() => setShowPast((shown) => !shown)}
              testID="toggle-past"
            />
            {showPast ? (
              <Card title={t('partner.bookings.past')}>
                <View style={styles.list}>{past.map(card)}</View>
              </Card>
            ) : null}
          </>
        ) : null}
        {all.length && !requests.length && !upcoming.length && !showPast ? (
          <BodyText>{t('partner.bookings.empty')}</BodyText>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.page}>
      {filters}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  filters: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  date: { flexGrow: 1, flexBasis: 140 },
  list: { gap: spacing.sm },
});
