import type { Database } from '@/api/database.types';
import { useDeleteRate, useSaveExtra } from '@/api/rates';
import { fieldErrors } from '@/domain/partners';
import {
  EMPTY_EXTRA,
  EXTRA_UNITS,
  extraFormSchema,
  extraToForm,
  type ExtraForm,
} from '@/domain/rates';
import { localized, useLanguage, useT } from '@/i18n';
import { Badge, BodyText, ChoiceGroup, EditableList, SectionLabel, TextField } from '@/ui';

import { EditorFrame, useFormState } from './EditorFrame';

type Extra = Database['public']['Tables']['extras']['Row'];

export function ExtrasSection({
  campingId,
  extras,
  canEdit,
}: {
  campingId: string;
  extras: Extra[];
  canEdit: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <EditableList
      title={t('partner.rates.extras.title')}
      items={extras}
      canEdit={canEdit}
      addLabel={t('partner.rates.extras.add')}
      editLabel={t('partner.rates.edit')}
      emptyText={t('partner.rates.extras.empty')}
      testID="extra"
      editA11yLabel={(extra) =>
        t('a11y.itemAction', {
          action: t('partner.rates.edit'),
          item: localized(extra.name, language),
        })
      }
      renderSummary={(extra) => (
        <>
          <BodyText>
            {localized(extra.name, language)} ·{' '}
            {t('partner.rates.extras.summary', {
              unit: t(`partner.rates.units.${extra.unit}`),
              qty: extra.max_qty,
            })}
          </BodyText>
          {!extra.active ? <Badge label={t('partner.rates.extras.hidden')} tone="warning" /> : null}
        </>
      )}
      renderEditor={(extra, close) => (
        <ExtraEditor campingId={campingId} extra={extra} onDone={close} />
      )}
    />
  );
}

function ExtraEditor({
  campingId,
  extra,
  onDone,
}: {
  campingId: string;
  extra?: Extra;
  onDone: () => void;
}) {
  const t = useT();
  const save = useSaveExtra(campingId);
  const remove = useDeleteRate(campingId, 'extras');
  const form = useFormState<ExtraForm>(extra ? extraToForm(extra) : EMPTY_EXTRA);
  const field = (key: 'nameEl' | 'nameEn' | 'maxQty') => ({
    label: t(key === 'maxQty' ? 'partner.rates.extras.maxQty' : `partner.rates.${key}`),
    value: form.values[key],
    onChangeText: (text: string) => form.set(key, text),
    error: form.errorFor(key),
    testID: `extra-${key}`,
  });

  const submit = () => {
    const parsed = extraFormSchema.safeParse(form.values);
    if (!parsed.success) return form.setErrors(fieldErrors<keyof ExtraForm>(parsed.error));
    form.setErrors({});
    save.mutate({ id: extra?.id, values: parsed.data }, { onSuccess: onDone });
  };

  return (
    <EditorFrame
      onSave={submit}
      onCancel={onDone}
      onDelete={extra ? () => remove.mutate(extra.id, { onSuccess: onDone }) : undefined}
      saving={save.isPending}
      deleting={remove.isPending}
      error={save.isError || remove.isError ? t('common.error') : null}
      testID="extra"
    >
      <TextField {...field('nameEl')} />
      <TextField {...field('nameEn')} />
      <SectionLabel>{t('partner.rates.extras.unit')}</SectionLabel>
      <ChoiceGroup
        options={EXTRA_UNITS.map((u) => ({ value: u, label: t(`partner.rates.units.${u}`) }))}
        selected={form.values.unit}
        onChange={(unit) => form.set('unit', unit)}
        testID="extra-unit"
      />
      <TextField {...field('maxQty')} keyboardType="number-pad" inputMode="numeric" />
      <SectionLabel>{t('partner.pitchTypes.visibility')}</SectionLabel>
      <ChoiceGroup
        options={[
          { value: 'shown', label: t('partner.pitchTypes.active') },
          { value: 'hidden', label: t('partner.pitchTypes.inactive') },
        ]}
        selected={form.values.active ? 'shown' : 'hidden'}
        onChange={(v) => form.set('active', v === 'shown')}
        testID="extra-visibility"
      />
    </EditorFrame>
  );
}
