import type { Database } from '@/api/database.types';
import { useDeleteRate, useSaveGuestCategory } from '@/api/rates';
import { errorCode } from '@/domain/errors';
import { fieldErrors } from '@/domain/partners';
import {
  EMPTY_GUEST_CATEGORY,
  guestCategoryFormSchema,
  guestCategoryToForm,
  type GuestCategoryForm,
} from '@/domain/rates';
import { localized, useLanguage, useT } from '@/i18n';
import { BodyText, EditableList, TextField } from '@/ui';

import { EditorFrame, useFormState } from './EditorFrame';

type GuestCategory = Database['public']['Tables']['guest_categories']['Row'];

type Props = { campingId: string; guestCategories: GuestCategory[]; canEdit: boolean };

export function GuestCategoriesSection({ campingId, guestCategories, canEdit }: Props) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <EditableList
      title={t('partner.rates.guests.title')}
      items={guestCategories}
      canEdit={canEdit}
      addLabel={t('partner.rates.guests.add')}
      editLabel={t('partner.rates.edit')}
      emptyText={t('partner.rates.guests.empty')}
      testID="guest"
      renderSummary={(category) => (
        <BodyText>
          {localized(category.name, language)} ·{' '}
          {category.max_age === null
            ? t('partner.rates.guests.agesFrom', { min: category.min_age })
            : t('partner.rates.guests.agesRange', { min: category.min_age, max: category.max_age })}
        </BodyText>
      )}
      renderEditor={(category, close) => (
        <GuestCategoryEditor campingId={campingId} category={category} onDone={close} />
      )}
    />
  );
}

function GuestCategoryEditor(props: {
  campingId: string;
  category?: GuestCategory;
  onDone: () => void;
}) {
  const { campingId, category, onDone } = props;
  const t = useT();
  const save = useSaveGuestCategory(campingId);
  const remove = useDeleteRate(campingId, 'guest_categories');
  const form = useFormState<GuestCategoryForm>(
    category ? guestCategoryToForm(category) : EMPTY_GUEST_CATEGORY,
  );
  const field = (key: keyof GuestCategoryForm) => ({
    label: t(
      key === 'nameEl' || key === 'nameEn' ? `partner.rates.${key}` : `partner.rates.guests.${key}`,
    ),
    value: form.values[key],
    onChangeText: (text: string) => form.set(key, text),
    error: form.errorFor(key),
    testID: `guest-${key}`,
  });

  const submit = () => {
    const parsed = guestCategoryFormSchema.safeParse(form.values);
    if (!parsed.success) return form.setErrors(fieldErrors<keyof GuestCategoryForm>(parsed.error));
    form.setErrors({});
    save.mutate({ id: category?.id, values: parsed.data }, { onSuccess: onDone });
  };

  const failure = save.error ?? remove.error;
  return (
    <EditorFrame
      onSave={submit}
      onCancel={onDone}
      onDelete={category ? () => remove.mutate(category.id, { onSuccess: onDone }) : undefined}
      saving={save.isPending}
      deleting={remove.isPending}
      error={
        failure
          ? errorCode(failure) === '23P01'
            ? t('partner.rates.guests.overlap')
            : t('common.error')
          : null
      }
      testID="guest"
    >
      <TextField {...field('nameEl')} />
      <TextField {...field('nameEn')} />
      <TextField {...field('minAge')} keyboardType="number-pad" inputMode="numeric" />
      <TextField {...field('maxAge')} keyboardType="number-pad" inputMode="numeric" />
    </EditorFrame>
  );
}
