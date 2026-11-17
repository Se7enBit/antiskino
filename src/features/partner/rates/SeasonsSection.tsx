import { useDeleteRate, useSaveSeason } from '@/api/rates';
import type { Database } from '@/api/database.types';
import { errorCode } from '@/domain/errors';
import { fieldErrors } from '@/domain/partners';
import {
  EMPTY_SEASON,
  parseNightRange,
  seasonFormSchema,
  seasonToForm,
  type SeasonForm,
} from '@/domain/rates';
import { localized, useLanguage, useT } from '@/i18n';
import { formatDateInput } from '@/lib/dates';
import { BodyText, EditableList, TextField } from '@/ui';

import { EditorFrame, useFormState } from './EditorFrame';

type Season = Database['public']['Tables']['seasons']['Row'];

export function SeasonsSection({
  campingId,
  seasons,
  canEdit,
}: {
  campingId: string;
  seasons: Season[];
  canEdit: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <EditableList
      title={t('partner.rates.seasons.title')}
      items={seasons}
      canEdit={canEdit}
      addLabel={t('partner.rates.seasons.add')}
      editLabel={t('partner.rates.edit')}
      emptyText={t('partner.rates.seasons.empty')}
      testID="season"
      renderSummary={(season) => {
        const range = parseNightRange(season.dates);
        return (
          <BodyText>
            {localized(season.name, language)}
            {range
              ? ` · ${t('partner.rates.seasons.summary', {
                  from: formatDateInput(range.firstNight),
                  to: formatDateInput(range.lastNight),
                  nights: season.min_nights,
                })}`
              : ''}
          </BodyText>
        );
      }}
      renderEditor={(season, close) => (
        <SeasonEditor campingId={campingId} season={season} onDone={close} />
      )}
    />
  );
}

function SeasonEditor({
  campingId,
  season,
  onDone,
}: {
  campingId: string;
  season?: Season;
  onDone: () => void;
}) {
  const t = useT();
  const save = useSaveSeason(campingId);
  const remove = useDeleteRate(campingId, 'seasons');
  const form = useFormState<SeasonForm>(season ? seasonToForm(season) : EMPTY_SEASON);
  const field = (key: keyof SeasonForm) => ({
    label: t(
      key === 'nameEl' || key === 'nameEn'
        ? `partner.rates.${key}`
        : `partner.rates.seasons.${key}`,
    ),
    value: form.values[key],
    onChangeText: (text: string) => form.set(key, text),
    error: form.errorFor(key),
    testID: `season-${key}`,
  });

  const submit = () => {
    const parsed = seasonFormSchema.safeParse(form.values);
    if (!parsed.success) return form.setErrors(fieldErrors<keyof SeasonForm>(parsed.error));
    form.setErrors({});
    save.mutate({ id: season?.id, values: parsed.data }, { onSuccess: onDone });
  };

  const failure = save.error ?? remove.error;
  return (
    <EditorFrame
      onSave={submit}
      onCancel={onDone}
      onDelete={season ? () => remove.mutate(season.id, { onSuccess: onDone }) : undefined}
      saving={save.isPending}
      deleting={remove.isPending}
      error={
        failure
          ? errorCode(failure) === '23P01'
            ? t('partner.rates.seasons.overlap')
            : t('common.error')
          : null
      }
      testID="season"
    >
      <TextField {...field('nameEl')} />
      <TextField {...field('nameEn')} />
      <TextField {...field('firstNight')} inputMode="numeric" />
      <TextField {...field('lastNight')} inputMode="numeric" />
      <BodyText>{t('partner.rates.seasons.dateHint')}</BodyText>
      <TextField {...field('minNights')} keyboardType="number-pad" inputMode="numeric" />
    </EditorFrame>
  );
}
