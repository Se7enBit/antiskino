import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSetClosed } from '@/api/inventory';
import {
  availabilityErrors,
  closingFormSchema,
  type AvailabilityError,
  type ClosingForm as Values,
} from '@/domain/availability';
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

/** The whole team: stop or restart online sales for some nights. */
export function ClosingForm({ pitchTypes, pick }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const setClosed = useSetClosed();
  const night = pick ? formatDateInput(pick.night) : '';
  const [values, setValues] = useState<Values>({
    pitchTypeIds: pick ? [pick.pitchTypeId] : pitchTypes.map((p) => p.id),
    firstNight: night,
    lastNight: night,
  });
  const [errors, setErrors] = useState<Set<AvailabilityError>>(new Set());
  // what the last request did, for the success message
  const [closing, setClosing] = useState(true);
  const update = (patch: Partial<Values>) => {
    setValues((current) => ({ ...current, ...patch }));
    setClosed.reset();
  };
  const toggle = (id: string) =>
    update({
      pitchTypeIds: values.pitchTypeIds.includes(id)
        ? values.pitchTypeIds.filter((x) => x !== id)
        : [...values.pitchTypeIds, id],
    });
  const message = (key: AvailabilityError) =>
    errors.has(key) ? t(`partner.availability.errors.${key}`) : null;

  const submit = (closed: boolean) => {
    const parsed = closingFormSchema.safeParse(values);
    if (!parsed.success) return setErrors(availabilityErrors(parsed.error));
    setErrors(new Set());
    setClosing(closed);
    setClosed.mutate({ values: parsed.data, closed });
  };

  return (
    <Card title={t('partner.availability.closing.title')}>
      <View style={styles.form}>
        <BodyText>{t('partner.availability.closing.hint')}</BodyText>
        <SectionLabel>{t('partner.availability.closing.pitchTypes')}</SectionLabel>
        <ChoiceGroup
          options={pitchTypes.map((p) => ({ value: p.id, label: localized(p.name, language) }))}
          selected={values.pitchTypeIds}
          onChange={toggle}
          testID="closing-pitch"
        />
        {message('pitchType') ? <Notice tone="error" message={message('pitchType')!} /> : null}
        <TextField
          label={t('partner.availability.firstNight')}
          value={values.firstNight}
          onChangeText={(text) => update({ firstNight: text })}
          inputMode="numeric"
          error={message('firstNight')}
          testID="closing-firstNight"
        />
        <TextField
          label={t('partner.availability.lastNight')}
          value={values.lastNight}
          onChangeText={(text) => update({ lastNight: text })}
          inputMode="numeric"
          error={message('lastNight') ?? message('tooLong')}
          testID="closing-lastNight"
        />
        {setClosed.isError ? <Notice tone="error" message={t('common.error')} /> : null}
        {setClosed.isSuccess ? (
          <Notice
            message={t(`partner.availability.closing.${closing ? 'closed' : 'opened'}`, {
              count: setClosed.data,
            })}
          />
        ) : null}
        <View style={styles.actions}>
          <Button
            label={t('partner.availability.closing.close')}
            variant="primary"
            onPress={() => submit(true)}
            loading={setClosed.isPending && closing}
            disabled={setClosed.isPending}
            testID="closing-close"
          />
          <Button
            label={t('partner.availability.closing.open')}
            onPress={() => submit(false)}
            loading={setClosed.isPending && !closing}
            disabled={setClosed.isPending}
            testID="closing-open"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
