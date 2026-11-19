import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  STATUS_FILTERS,
  defaultRange,
  filterBookings,
  parseRange,
  type StatusFilter,
} from '@/domain/partnerBookings';
import { useT } from '@/i18n';
import type { IsoDate } from '@/lib/dates';
import { BodyText, Button, ChoiceGroup, TextField, spacing } from '@/ui';

/** Search, status and date range for a bookings list (partner Bookings, admin Bookings). */
export function useBookingFilters(today: IsoDate) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [open, setOpen] = useState(false);
  const parsed = parseRange(fromText, toText, today);
  return {
    text,
    setText,
    status,
    setStatus,
    fromText,
    setFromText,
    toText,
    setToText,
    open,
    setOpen,
    rangeError: 'error' in parsed ? parsed.error : null,
    /** The stays to load: the typed range, or the default one while it is incomplete. */
    range: 'range' in parsed ? parsed.range : defaultRange(today),
    active:
      text.trim() !== '' || status !== 'all' || fromText.trim() !== '' || toText.trim() !== '',
    clear: () => {
      setText('');
      setStatus('all');
      setFromText('');
      setToText('');
    },
    apply: <T extends { status: string; guest_name: string; ref: string }>(list: T[]) =>
      filterBookings(list, { status, text }),
  };
}

export type BookingFiltersState = ReturnType<typeof useBookingFilters>;

export function BookingFilters({ filters }: { filters: BookingFiltersState }) {
  const t = useT();
  const dateError = t('partner.bookings.filter.dateError');
  return (
    <View style={styles.filters}>
      <TextField
        label={t('partner.bookings.filter.search')}
        value={filters.text}
        onChangeText={filters.setText}
        autoCapitalize="none"
        testID="booking-search"
      />
      <View style={styles.row}>
        <Button
          label={
            filters.open ? t('partner.bookings.filter.hide') : t('partner.bookings.filter.show')
          }
          icon="filter-variant"
          onPress={() => filters.setOpen(!filters.open)}
          testID="toggle-filters"
        />
        {filters.active ? (
          <Button label={t('partner.bookings.filter.clear')} onPress={filters.clear} />
        ) : null}
      </View>
      {filters.open ? (
        <>
          <ChoiceGroup
            options={STATUS_FILTERS.map((value) => ({
              value,
              label: t(`partner.bookings.filter.status.${value}`),
            }))}
            selected={filters.status}
            onChange={filters.setStatus}
            testID="status-filter"
          />
          <View style={styles.row}>
            <View style={styles.date}>
              <TextField
                label={t('partner.bookings.filter.from')}
                value={filters.fromText}
                onChangeText={filters.setFromText}
                inputMode="numeric"
                error={filters.rangeError === 'from' ? dateError : null}
                testID="range-from"
              />
            </View>
            <View style={styles.date}>
              <TextField
                label={t('partner.bookings.filter.to')}
                value={filters.toText}
                onChangeText={filters.setToText}
                inputMode="numeric"
                error={filters.rangeError === 'to' ? dateError : null}
                testID="range-to"
              />
            </View>
          </View>
          <BodyText>{t('partner.bookings.filter.rangeHint')}</BodyText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  date: { flexGrow: 1, flexBasis: 140 },
});
