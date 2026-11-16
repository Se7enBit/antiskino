import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCreatePartner } from '@/api/admin';
import {
  fieldErrors,
  partnerFormSchema,
  type PartnerFormField,
  type PartnerFormValues,
} from '@/domain/partners';
import { useT } from '@/i18n';
import { BodyText, Button, Card, Notice, Screen, TextField, spacing } from '@/ui';

const EMPTY: PartnerFormValues = {
  name: '',
  legalName: '',
  vatNumber: '',
  billingEmail: '',
  commissionPercent: '',
};

/** Admin: create a partner company, then continue on its page. */
export function PartnerForm() {
  const t = useT();
  const createPartner = useCreatePartner();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<PartnerFormField, true>>>({});

  const field = (name: PartnerFormField) => ({
    value: values[name],
    onChangeText: (text: string) => setValues((current) => ({ ...current, [name]: text })),
    error: errors[name] ? t(`admin.partnerForm.errors.${name}`) : null,
    testID: `partner-${name}`,
  });

  const submit = () => {
    const parsed = partnerFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<PartnerFormField>(parsed.error));
      return;
    }
    setErrors({});
    createPartner.mutate(parsed.data, {
      onSuccess: (id) => router.replace({ pathname: '/admin/partner', params: { id } }),
    });
  };

  return (
    <Screen>
      <Card title={t('admin.partnerForm.title')}>
        <View style={styles.form}>
          <TextField label={t('admin.partnerForm.name')} autoFocus {...field('name')} />
          <TextField label={t('admin.partnerForm.legalName')} {...field('legalName')} />
          <TextField label={t('admin.partnerForm.vatNumber')} {...field('vatNumber')} />
          <TextField
            label={t('admin.partnerForm.billingEmail')}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            {...field('billingEmail')}
          />
          <TextField
            label={t('admin.partnerForm.commission')}
            keyboardType="decimal-pad"
            inputMode="decimal"
            {...field('commissionPercent')}
          />
          <BodyText>{t('admin.partnerForm.commissionHint')}</BodyText>
          <Button
            label={t('admin.partnerForm.submit')}
            variant="primary"
            onPress={submit}
            loading={createPartner.isPending}
            testID="partner-submit"
          />
          {createPartner.isError ? <Notice tone="error" message={t('common.error')} /> : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
