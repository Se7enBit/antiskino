import type { Database } from '@/api/database.types';
import { useDeleteRate, useSaveFee } from '@/api/rates';
import { fieldErrors } from '@/domain/partners';
import { EMPTY_FEE, FEE_UNITS, feeFormSchema, type FeeForm } from '@/domain/rates';
import { textIn } from '@/domain/localizedText';
import { localized, useLanguage, useT } from '@/i18n';
import { centsToInput, formatMoney } from '@/lib/money';
import { BodyText, ChoiceGroup, EditableList, SectionLabel, TextField } from '@/ui';

import { EditorFrame, useFormState } from './EditorFrame';

type Fee = Database['public']['Tables']['fees']['Row'];

export function FeesSection({
  campingId,
  fees,
  canEdit,
}: {
  campingId: string;
  fees: Fee[];
  canEdit: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <EditableList
      title={t('partner.rates.fees.title')}
      items={fees}
      canEdit={canEdit}
      addLabel={t('partner.rates.fees.add')}
      editLabel={t('partner.rates.edit')}
      emptyText={t('partner.rates.fees.empty')}
      testID="fee"
      editA11yLabel={(fee) =>
        t('a11y.itemAction', {
          action: t('partner.rates.edit'),
          item: localized(fee.name, language),
        })
      }
      renderSummary={(fee) => (
        <BodyText>
          {localized(fee.name, language)} · {t(`partner.rates.units.${fee.unit}`)} ·{' '}
          {formatMoney(fee.amount_cents, language)}
        </BodyText>
      )}
      renderEditor={(fee, close) => <FeeEditor campingId={campingId} fee={fee} onDone={close} />}
    />
  );
}

function FeeEditor({
  campingId,
  fee,
  onDone,
}: {
  campingId: string;
  fee?: Fee;
  onDone: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const save = useSaveFee(campingId);
  const remove = useDeleteRate(campingId, 'fees');
  const form = useFormState<FeeForm>(
    fee
      ? {
          nameEl: textIn(fee.name, 'el'),
          nameEn: textIn(fee.name, 'en'),
          unit: fee.unit,
          amount: centsToInput(fee.amount_cents, language),
        }
      : EMPTY_FEE,
  );
  const field = (key: 'nameEl' | 'nameEn' | 'amount') => ({
    label: t(key === 'amount' ? 'partner.rates.fees.amount' : `partner.rates.${key}`),
    value: form.values[key],
    onChangeText: (text: string) => form.set(key, text),
    error: form.errorFor(key),
    testID: `fee-${key}`,
  });

  const submit = () => {
    const parsed = feeFormSchema.safeParse(form.values);
    if (!parsed.success) return form.setErrors(fieldErrors<keyof FeeForm>(parsed.error));
    form.setErrors({});
    save.mutate({ id: fee?.id, values: parsed.data }, { onSuccess: onDone });
  };

  return (
    <EditorFrame
      onSave={submit}
      onCancel={onDone}
      onDelete={fee ? () => remove.mutate(fee.id, { onSuccess: onDone }) : undefined}
      saving={save.isPending}
      deleting={remove.isPending}
      error={save.isError || remove.isError ? t('common.error') : null}
      testID="fee"
    >
      <TextField {...field('nameEl')} />
      <TextField {...field('nameEn')} />
      <SectionLabel>{t('partner.rates.extras.unit')}</SectionLabel>
      <ChoiceGroup
        options={FEE_UNITS.map((u) => ({ value: u, label: t(`partner.rates.units.${u}`) }))}
        selected={form.values.unit}
        onChange={(unit) => form.set('unit', unit)}
        testID="fee-unit"
      />
      <TextField {...field('amount')} keyboardType="decimal-pad" inputMode="decimal" />
    </EditorFrame>
  );
}
