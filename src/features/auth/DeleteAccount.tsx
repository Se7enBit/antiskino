import { StyleSheet, View } from 'react-native';

import { useDeleteAccount } from '@/api/account';
import { useAuth } from '@/api/auth';
import { useT } from '@/i18n';
import { BodyText, Card, ConfirmButton, Notice, spacing } from '@/ui';

/** Deleting the signed-in account (Account tab and /delete-account). */
export function DeleteAccount() {
  const t = useT();
  const { status } = useAuth();
  const remove = useDeleteAccount();

  // Shown after the deletion signs the user out.
  if (remove.data?.deleted) return <Notice message={t('account.delete.done')} />;
  if (status !== 'signedIn') return null;
  return (
    <Card title={t('account.delete.title')}>
      <BodyText>{t('account.delete.explain')}</BodyText>
      {remove.data?.deleted === false ? (
        <Notice tone="error" message={t('account.delete.lastOwner')} />
      ) : null}
      {remove.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      <View style={styles.row}>
        <ConfirmButton
          label={t('account.delete.button')}
          question={t('account.delete.question')}
          yes={t('account.delete.yes')}
          no={t('manage.cancelNo')}
          onConfirm={() => remove.mutate()}
          loading={remove.isPending}
          testID="delete-account"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
