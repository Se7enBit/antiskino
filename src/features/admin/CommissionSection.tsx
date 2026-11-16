import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useUpdateCommission } from '@/api/admin';
import { bpsToPercentInput, commissionPercentSchema } from '@/domain/commission';
import { useLanguage, useT } from '@/i18n';
import { BodyText, Button, Card, Notice, TextField, spacing } from '@/ui';

type Props = { partnerId: string; commissionBps: number | null };

export function CommissionSection({ partnerId, commissionBps }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const update = useUpdateCommission(partnerId);
  const [value, setValue] = useState(() => bpsToPercentInput(commissionBps, language));
  const [invalid, setInvalid] = useState(false);

  const save = () => {
    const parsed = commissionPercentSchema.safeParse(value);
    setInvalid(!parsed.success);
    if (parsed.success) update.mutate(parsed.data);
  };

  return (
    <Card title={t('admin.partners.commission')}>
      <View style={styles.row}>
        <TextField
          label={t('admin.partnerForm.commission')}
          value={value}
          onChangeText={setValue}
          error={invalid ? t('admin.partnerForm.errors.commissionPercent') : null}
          keyboardType="decimal-pad"
          inputMode="decimal"
          testID="commission"
        />
        <BodyText>{t('admin.partnerForm.commissionHint')}</BodyText>
        <Button
          label={t('common.save')}
          onPress={save}
          loading={update.isPending}
          testID="commission-save"
        />
        {update.isSuccess ? <Notice message={t('admin.partner.commissionSaved')} /> : null}
        {update.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
});
