import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Database } from '@/api/database.types';
import { useSetPitchTypePhotos } from '@/api/photos';
import { useSavePitchType } from '@/api/pitchTypes';
import { fieldErrors } from '@/domain/partners';
import {
  EMPTY_PITCH_TYPE,
  EQUIPMENT,
  pitchTypeFormSchema,
  pitchTypeToForm,
  type PitchTypeField,
  type PitchTypeForm,
} from '@/domain/pitchTypes';
import { PhotoGrid } from '@/features/photos/PhotoGrid';
import { useT } from '@/i18n';
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

type PitchTypeRow = Database['public']['Tables']['pitch_types']['Row'];

type TextKey = Exclude<PitchTypeField, 'accepts' | 'active'>;

type Props = {
  campingId: string;
  /** Missing for a new pitch type. */
  pitchType?: PitchTypeRow;
  /** Sort position for a new pitch type. */
  sort: number;
  onDone: () => void;
};

export function PitchTypeEditor({ campingId, pitchType, sort, onDone }: Props) {
  const t = useT();
  const save = useSavePitchType(campingId);
  const setPhotos = useSetPitchTypePhotos(campingId);
  const [values, setValues] = useState<PitchTypeForm>(() =>
    pitchType ? pitchTypeToForm(pitchType) : EMPTY_PITCH_TYPE,
  );
  const [errors, setErrors] = useState<Partial<Record<PitchTypeField, true>>>({});

  const set = <K extends PitchTypeField>(key: K, value: PitchTypeForm[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const field = (key: TextKey, multiline = false) => ({
    label: t(`partner.pitchTypes.${key}`),
    value: values[key],
    onChangeText: (text: string) => set(key, text),
    error: errors[key] ? t(`partner.pitchTypes.errors.${key}`) : null,
    multiline,
    testID: `pitch-${key}`,
  });

  const submit = () => {
    const parsed = pitchTypeFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<PitchTypeField>(parsed.error));
      return;
    }
    setErrors({});
    save.mutate({ id: pitchType?.id, values: parsed.data, sort }, { onSuccess: onDone });
  };

  const photos = pitchType?.photos ?? [];

  return (
    <Card>
      <View style={styles.form}>
        <TextField {...field('nameEl')} />
        <TextField {...field('nameEn')} />
        <TextField {...field('descrEl', true)} />
        <TextField {...field('descrEn', true)} />
        <TextField {...field('includedEl', true)} />
        <TextField {...field('includedEn', true)} />

        <SectionLabel>{t('partner.pitchTypes.accepts')}</SectionLabel>
        <ChoiceGroup
          options={EQUIPMENT.map((e) => ({ value: e, label: t(`equipment.${e}`) }))}
          selected={values.accepts}
          onChange={(e) =>
            set(
              'accepts',
              values.accepts.includes(e)
                ? values.accepts.filter((x) => x !== e)
                : [...values.accepts, e],
            )
          }
          testID="pitch-accepts"
        />
        {errors.accepts ? (
          <Notice tone="error" message={t('partner.pitchTypes.errors.accepts')} />
        ) : null}

        <TextField {...field('maxPeople')} keyboardType="number-pad" inputMode="numeric" />
        <TextField {...field('sizeM2')} keyboardType="number-pad" inputMode="numeric" />

        <SectionLabel>{t('partner.pitchTypes.visibility')}</SectionLabel>
        <ChoiceGroup
          options={[
            { value: 'shown', label: t('partner.pitchTypes.active') },
            { value: 'hidden', label: t('partner.pitchTypes.inactive') },
          ]}
          selected={values.active ? 'shown' : 'hidden'}
          onChange={(v) => set('active', v === 'shown')}
          testID="pitch-visibility"
        />

        <SectionLabel>{t('photos.title')}</SectionLabel>
        {pitchType ? (
          <PhotoGrid
            campingId={campingId}
            photos={photos.map((path) => ({ key: path, path }))}
            canEdit
            busy={setPhotos.isPending}
            onAdd={(path) =>
              setPhotos.mutate({ pitchTypeId: pitchType.id, photos: [...photos, path] })
            }
            onRemove={(photo) =>
              setPhotos.mutate({
                pitchTypeId: pitchType.id,
                photos: photos.filter((p) => p !== photo.path),
                removed: [photo.path],
              })
            }
          />
        ) : (
          <BodyText>{t('partner.pitchTypes.photosAfterSave')}</BodyText>
        )}

        {save.isError || setPhotos.isError ? (
          <Notice tone="error" message={t('common.error')} />
        ) : null}
        <View style={styles.actions}>
          <Button
            label={t('partner.pitchTypes.save')}
            variant="primary"
            onPress={submit}
            loading={save.isPending}
            testID="pitch-save"
          />
          <Button label={t('common.cancel')} onPress={onDone} testID="pitch-cancel" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
