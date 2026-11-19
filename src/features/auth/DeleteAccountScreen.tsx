import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/api/auth';
import { useT } from '@/i18n';
import { BodyText, Screen, colors } from '@/ui';

import { AccountSignIn } from './AccountSignIn';
import { DeleteAccount } from './DeleteAccount';

/** /delete-account: the public page stores link to for deleting an account. */
export function DeleteAccountScreen() {
  const t = useT();
  const { status } = useAuth();
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        {t('account.delete.pageTitle')}
      </Text>
      <BodyText>{t('account.delete.explain')}</BodyText>
      {status !== 'signedIn' ? <BodyText>{t('account.delete.signInFirst')}</BodyText> : null}
      <AccountSignIn />
      <DeleteAccount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
});
