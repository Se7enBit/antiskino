import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Language } from '@/i18n/languages';
import { addDays, addMonths, monthGrid, monthStart, type IsoDate } from '@/lib/dates';
import { formatMonth, formatNight } from '@/lib/format';

import { Button } from './Button';
import { colors, spacing } from './theme';

export type DateRange = { arrival: IsoDate | null; departure: IsoDate | null };

type Props = DateRange & {
  onChange: (range: DateRange) => void;
  /** The first day that can be picked (today). */
  minDate: IsoDate;
  maxNights: number;
  language: Language;
  labels: { previousMonth: string; nextMonth: string };
};

/** The weekday names, Monday first, from a known Monday. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2024-01-01', i));

/**
 * A month calendar: the first tap picks the arrival day, the second the
 * departure day. Tapping a day on or before the arrival starts over.
 */
export function DateRangePicker({
  arrival,
  departure,
  onChange,
  minDate,
  maxNights,
  language,
  labels,
}: Props) {
  const [month, setMonth] = useState(() => monthStart(arrival ?? minDate));
  const choosingDeparture = arrival !== null && departure === null;
  const lastDeparture = arrival ? addDays(arrival, maxNights) : null;

  const pick = (day: IsoDate) => {
    if (choosingDeparture && day > arrival) onChange({ arrival, departure: day });
    else onChange({ arrival: day, departure: null });
  };
  const disabled = (day: IsoDate) =>
    day < minDate || (choosingDeparture && lastDeparture !== null && day > lastDeparture);
  const inRange = (day: IsoDate) =>
    arrival !== null && departure !== null && day > arrival && day < departure;

  return (
    <View style={styles.picker}>
      <View style={styles.header}>
        <Button
          label="‹"
          accessibilityLabel={labels.previousMonth}
          onPress={() => setMonth(addMonths(month, -1))}
          disabled={month <= monthStart(minDate)}
          testID="month-prev"
        />
        <Text style={styles.month} accessibilityRole="header">
          {formatMonth(month, language)}
        </Text>
        <Button
          label="›"
          accessibilityLabel={labels.nextMonth}
          onPress={() => setMonth(addMonths(month, 1))}
          testID="month-next"
        />
      </View>
      <View style={styles.week}>
        {WEEK.map((day) => (
          <Text key={day} style={[styles.cell, styles.weekday]}>
            {formatNight(day, language).weekday}
          </Text>
        ))}
      </View>
      {monthGrid(month).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => {
            if (!day) return <View key={j} style={styles.cell} />;
            const selected = day === arrival || day === departure;
            const off = disabled(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${formatNight(day, language).weekday} ${Number(day.slice(8))} ${formatMonth(day, language)}`}
                accessibilityState={{ selected, disabled: off }}
                disabled={off}
                onPress={() => pick(day)}
                style={[
                  styles.cell,
                  styles.day,
                  inRange(day) && styles.inRange,
                  selected && styles.selected,
                ]}
                testID={`day-${day}`}
              >
                <Text style={[styles.dayText, off && styles.off, selected && styles.selectedText]}>
                  {Number(day.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: spacing.xs, maxWidth: 420 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 17, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 48, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.muted, textAlign: 'center', aspectRatio: undefined },
  day: { borderRadius: 24 },
  dayText: { fontSize: 16, color: colors.text },
  off: { color: colors.border },
  inRange: { backgroundColor: colors.surface, borderRadius: 0 },
  selected: { backgroundColor: colors.primary },
  selectedText: { color: colors.onPrimary, fontWeight: '700' },
});
