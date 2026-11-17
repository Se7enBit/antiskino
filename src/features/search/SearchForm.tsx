import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DEFAULT_CHILD_AGE,
  EQUIPMENT,
  MAX_ADULTS,
  MAX_CHILD_AGE,
  MAX_CHILDREN,
  MAX_NIGHTS,
  stayProblem,
  toRequest,
  type Equipment,
  type SearchRequest,
  type StayProblem,
} from '@/domain/search';
import { useLanguage, useT } from '@/i18n';
import { formatDateInput, nightsBetween, todayInAthens } from '@/lib/dates';
import {
  BodyText,
  Button,
  ChoiceGroup,
  DateRangePicker,
  Notice,
  SectionLabel,
  Stepper,
  spacing,
  type IconName,
} from '@/ui';

import { useSearchStore } from './searchStore';

export const EQUIPMENT_ICONS: Record<Equipment, IconName> = {
  tent: 'tent',
  caravan: 'caravan',
  camper: 'rv-truck',
};

type Props = {
  /** Regions of the live campings; the filter shows with two or more. */
  regions: string[];
  onSearch: (request: SearchRequest) => void;
};

/** Dates, guests (adults + child ages), equipment and region (SPEC F1). */
export function SearchForm({ regions, onSearch }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const query = useSearchStore((s) => s.query);
  const update = useSearchStore((s) => s.update);
  // The calendar depends on today's date, so it only renders after a tap (static web HTML stays stable).
  const [calendar, setCalendar] = useState(false);
  const [problem, setProblem] = useState<StayProblem | null>(null);

  const setChildren = (count: number) =>
    update({
      childAges:
        count > query.childAges.length
          ? [...query.childAges, DEFAULT_CHILD_AGE]
          : query.childAges.slice(0, count),
    });
  const setChildAge = (index: number, age: number) =>
    update({ childAges: query.childAges.map((a, i) => (i === index ? age : a)) });

  const submit = () => {
    const found = stayProblem(query, todayInAthens());
    setProblem(found);
    const request = toRequest(query);
    if (!found && request) onSearch(request);
  };

  const dates =
    query.arrival && query.departure
      ? `${formatDateInput(query.arrival)} → ${formatDateInput(query.departure)} · ${t(
          'search.nights',
          {
            count: nightsBetween(query.arrival, query.departure),
          },
        )}`
      : query.arrival
        ? `${formatDateInput(query.arrival)} → …`
        : t('search.addDates');

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <SectionLabel>{t('search.dates')}</SectionLabel>
        <Button
          label={dates}
          icon="calendar-range"
          onPress={() => setCalendar((open) => !open)}
          selected={calendar}
          testID="search-dates"
        />
        {calendar ? (
          <>
            <BodyText>{t('search.datesHint')}</BodyText>
            <DateRangePicker
              arrival={query.arrival}
              departure={query.departure}
              onChange={(range) => {
                update(range);
                setProblem(null);
                if (range.departure) setCalendar(false);
              }}
              minDate={todayInAthens()}
              maxNights={MAX_NIGHTS}
              language={language}
              labels={{
                previousMonth: t('search.previousMonth'),
                nextMonth: t('search.nextMonth'),
              }}
            />
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('search.guests')}</SectionLabel>
        <Stepper
          label={t('search.adults')}
          value={query.adults}
          min={1}
          max={MAX_ADULTS}
          onChange={(adults) => update({ adults })}
          decreaseLabel={t('search.fewer')}
          increaseLabel={t('search.more')}
          testID="search-adults"
        />
        <Stepper
          label={t('search.children')}
          value={query.childAges.length}
          min={0}
          max={MAX_CHILDREN}
          onChange={setChildren}
          decreaseLabel={t('search.fewer')}
          increaseLabel={t('search.more')}
          testID="search-children"
        />
        {query.childAges.map((age, index) => (
          <Stepper
            key={index}
            label={t('search.childAge', { number: index + 1 })}
            value={age}
            min={0}
            max={MAX_CHILD_AGE}
            onChange={(value) => setChildAge(index, value)}
            decreaseLabel={t('search.fewer')}
            increaseLabel={t('search.more')}
            testID={`search-child-${index}`}
          />
        ))}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('search.equipment')}</SectionLabel>
        <View style={styles.row}>
          {EQUIPMENT.map((equipment) => (
            <Button
              key={equipment}
              label={t(`equipment.${equipment}`)}
              icon={EQUIPMENT_ICONS[equipment]}
              selected={query.equipment === equipment}
              onPress={() => update({ equipment })}
              testID={`search-equipment-${equipment}`}
            />
          ))}
        </View>
      </View>

      {regions.length > 1 ? (
        <View style={styles.section}>
          <SectionLabel>{t('search.region')}</SectionLabel>
          <ChoiceGroup
            options={[
              { value: '', label: t('search.allRegions') },
              ...regions.map((region) => ({ value: region, label: region })),
            ]}
            selected={query.region ?? ''}
            onChange={(region) => update({ region: region || null })}
            testID="search-region"
          />
        </View>
      ) : null}

      {problem ? <Notice tone="error" message={t(`search.problems.${problem}`)} /> : null}
      <Button
        label={t('search.search')}
        icon="magnify"
        variant="primary"
        onPress={submit}
        testID="search-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
