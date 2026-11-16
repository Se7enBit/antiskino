import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Database } from '@/api/database.types';
import { useUpdateCampingProfile } from '@/api/partner';
import { AMENITIES } from '@/domain/amenities';
import {
  CANCELLATION_POLICIES,
  CONFIRMATION_MODES,
  ENABLED_PAYMENT_MODES,
  PAYMENT_MODES,
  campingProfileSchema,
  campingToForm,
  type CampingProfileField,
  type CampingProfileForm as FormValues,
} from '@/domain/campingProfile';
import { fieldErrors } from '@/domain/partners';
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

type CampingRow = Database['public']['Tables']['campings']['Row'];

// Which message each invalid field shows.
const ERROR_KEYS: Partial<
  Record<CampingProfileField, 'name' | 'email' | 'coordinates' | 'time' | 'requestExpiryHours'>
> = {
  name: 'name',
  email: 'email',
  coordinates: 'coordinates',
  checkInFrom: 'time',
  checkOutUntil: 'time',
  sameDayCutoff: 'time',
  requestExpiryHours: 'requestExpiryHours',
};

type TextKey = Exclude<
  CampingProfileField,
  'amenities' | 'confirmationMode' | 'paymentMode' | 'cancellationPolicy'
>;

/** Owners edit the camping profile; staff see it read-only. */
export function CampingProfileForm({
  camping,
  canEdit,
}: {
  camping: CampingRow;
  canEdit: boolean;
}) {
  const t = useT();
  const save = useUpdateCampingProfile(camping.id);
  const [values, setValues] = useState<FormValues>(() => campingToForm(camping));
  const [errors, setErrors] = useState<Partial<Record<CampingProfileField, true>>>({});

  const set = <K extends CampingProfileField>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const field = (key: TextKey, extra: { multiline?: boolean } = {}) => ({
    label: t(`partner.profile.${key}`),
    value: values[key],
    onChangeText: (text: string) => set(key, text),
    error: errors[key] ? t(`partner.profile.errors.${ERROR_KEYS[key] ?? 'text'}`) : null,
    editable: canEdit,
    testID: `profile-${key}`,
    ...extra,
  });

  const submit = () => {
    const parsed = campingProfileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<CampingProfileField>(parsed.error));
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <View style={styles.form}>
      {!canEdit ? <Notice message={t('partner.ownersOnly')} /> : null}

      <Card title={t('partner.profile.sections.basics')}>
        <TextField {...field('name')} />
        <TextField {...field('region')} />
        <TextField {...field('address')} />
        <TextField {...field('phone')} keyboardType="phone-pad" inputMode="tel" />
        <TextField
          {...field('email')}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
        />
        <TextField {...field('coordinates')} inputMode="text" autoCapitalize="none" />
        <BodyText>{t('partner.profile.coordinatesHint')}</BodyText>
      </Card>

      <Card title={t('partner.profile.sections.texts')}>
        <TextField {...field('shortDescrEl', { multiline: true })} />
        <TextField {...field('shortDescrEn', { multiline: true })} />
        <TextField {...field('descrEl', { multiline: true })} />
        <TextField {...field('descrEn', { multiline: true })} />
        <TextField {...field('houseRulesEl', { multiline: true })} />
        <TextField {...field('houseRulesEn', { multiline: true })} />
      </Card>

      <Card title={t('partner.profile.sections.amenities')}>
        <ChoiceGroup
          options={AMENITIES.map((a) => ({ value: a, label: t(`amenities.${a}`) }))}
          selected={values.amenities}
          onChange={(amenity) =>
            set(
              'amenities',
              values.amenities.includes(amenity)
                ? values.amenities.filter((a) => a !== amenity)
                : [...values.amenities, amenity],
            )
          }
          disabled={!canEdit}
          testID="profile-amenity"
        />
      </Card>

      <Card title={t('partner.profile.sections.times')}>
        <TextField {...field('checkInFrom')} inputMode="numeric" />
        <TextField {...field('checkOutUntil')} inputMode="numeric" />
        <TextField {...field('sameDayCutoff')} inputMode="numeric" />
        <BodyText>{t('partner.profile.timeHint')}</BodyText>
      </Card>

      <Card title={t('partner.profile.sections.rules')}>
        <SectionLabel>{t('partner.profile.confirmationMode')}</SectionLabel>
        <ChoiceGroup
          options={CONFIRMATION_MODES.map((m) => ({
            value: m,
            label: t(`partner.profile.confirmation.${m}`),
          }))}
          selected={values.confirmationMode}
          onChange={(mode) => set('confirmationMode', mode)}
          disabled={!canEdit}
          testID="profile-confirmation"
        />
        <BodyText>{t(`partner.profile.confirmationHelp.${values.confirmationMode}`)}</BodyText>
        {values.confirmationMode === 'request' ? (
          <TextField
            {...field('requestExpiryHours')}
            keyboardType="number-pad"
            inputMode="numeric"
          />
        ) : null}

        <SectionLabel>{t('partner.profile.paymentMode')}</SectionLabel>
        <ChoiceGroup
          options={PAYMENT_MODES.map((m) => ({
            value: m,
            label: t(`partner.profile.payment.${m}`),
            disabled: !(ENABLED_PAYMENT_MODES as readonly string[]).includes(m),
          }))}
          selected={values.paymentMode}
          onChange={(mode) => set('paymentMode', mode)}
          disabled={!canEdit}
          testID="profile-payment"
        />
        <BodyText>{t('partner.profile.onlinePaymentsLater')}</BodyText>

        <SectionLabel>{t('partner.profile.cancellationPolicy')}</SectionLabel>
        <ChoiceGroup
          options={CANCELLATION_POLICIES.map((p) => ({
            value: p,
            label: t(`partner.profile.cancellation.${p}`),
          }))}
          selected={values.cancellationPolicy}
          onChange={(policy) => set('cancellationPolicy', policy)}
          disabled={!canEdit}
          testID="profile-cancellation"
        />
        <BodyText>{t(`partner.profile.cancellationHelp.${values.cancellationPolicy}`)}</BodyText>
        <BodyText>{t('partner.profile.onSiteNote')}</BodyText>
      </Card>

      {canEdit ? (
        <View style={styles.save}>
          {hasErrors ? <Notice tone="error" message={t('common.checkFields')} /> : null}
          {save.isError ? <Notice tone="error" message={t('common.error')} /> : null}
          {save.isSuccess && !hasErrors ? <Notice message={t('partner.profile.saved')} /> : null}
          <Button
            label={t('partner.profile.save')}
            variant="primary"
            onPress={submit}
            loading={save.isPending}
            testID="profile-save"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  save: { gap: spacing.sm, paddingBottom: spacing.xl },
});
