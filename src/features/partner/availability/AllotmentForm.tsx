import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSetAllotment } from '@/api/inventory';
import {
  allotmentFormSchema,
  availabilityErrors,
  type AllotmentForm as Values,
  type AvailabilityError,
} from '@/domain/availability';
import { errorCode } from '@/domain/errors';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput } from '@/lib/dates';
import {
  BodyText,
  Button,
  Card,
  ChoiceGroup,
  Notice,
  SectionLabel,
  TextField,
  spacing,
} from '@/ui';

import type { GridPitchType, Pick } from './AvailabilityGrid';

type Props = { pitchTypes: GridPitchType[]; pick: Pick | null };

/** Owners: set the allotment of one pitch type for a range of nights. */
export function AllotmentForm({ pitchTypes, pick }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const setAllotment = useSetAllotment();
  const night = pick ? formatDateInput(pick.night) : '';
  const [values, setValues] = useState<Values>({
    pitchTypeId: pick?.pitchTypeId ?? pitchTypes[0]?.id ?? '',
    firstNight: night,
    lastNight: night,
    allotment: pick?.allotment === undefined ? '' : String(pick.allotment),
  });
  const [errors, setErrors] = useState<Set<AvailabilityError>>(new Set());
  const set = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setAllotment.reset();
  };
  const message = (key: AvailabilityError) =>
    errors.has(key) ? t(`partner.availability.errors.${key}`) : null;

  const submit = () => {
    const parsed = allotmentFormSchema.safeParse(values);
    if (!parsed.success) return setErrors(availabilityErrors(parsed.error));
    setErrors(new Set());
    setAllotment.mutate(parsed.data);
  };

  const failure = setAllotment.error;
  return (
    <Card title={t('partner.availability.allotment.title')}>
      <View style={styles.form}>
        <BodyText>{t('partner.availability.allotment.hint')}</BodyText>
        <SectionLabel>{t('partner.availability.pitchType')}</SectionLabel>
        <ChoiceGroup
          options={pitchTypes.map((p) => ({ value: p.id, label: localized(p.name, language) }))}
          selected={values.pitchTypeId}
          onChange={(id) => set('pitchTypeId', id)}
          testID="allotment-pitch"
        />
        {message('pitchType') ? <Notice tone="error" message={message('pitchType')!} /> : null}
        <TextField
          label={t('partner.availability.firstNight')}
          value={values.firstNight}
          onChangeText={(text) => set('firstNight', text)}
          inputMode="numeric"
          error={message('firstNight')}
          testID="allotment-firstNight"
        />
        <TextField
          label={t('partner.availability.lastNight')}
          value={values.lastNight}
          onChangeText={(text) => set('lastNight', text)}
          inputMode="numeric"
          error={message('lastNight') ?? message('tooLong')}
          testID="allotment-lastNight"
        />
        <TextField
          label={t('partner.availability.allotment.value')}
          value={values.allotment}
          onChangeText={(text) => set('allotment', text)}
          keyboardType="number-pad"
          inputMode="numeric"
          error={message('allotment')}
          testID="allotment-value"
        />
        {failure ? (
          <Notice
            tone="error"
            message={
              errorCode(failure) === '23514'
                ? t('partner.availability.errors.belowBooked')
                : t('common.error')
            }
          />
        ) : null}
        {setAllotment.isSuccess ? (
          <Notice
            message={t('partner.availability.allotment.saved', { count: setAllotment.data })}
          />
        ) : null}
        <Button
          label={t('partner.availability.allotment.save')}
          variant="primary"
          onPress={submit}
          loading={setAllotment.isPending}
          testID="allotment-save"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
