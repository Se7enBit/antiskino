import { useSignOut, useAuth } from '@/api/auth';
import { useT } from '@/i18n';
import { BodyText, Button, Card, Loading, Notice } from '@/ui';

import { SignInForm } from './SignInForm';

/** The sign-in part of the Account tab. */
export function AccountSignIn() {
  const t = useT();
  const { status, session } = useAuth();
  const signOut = useSignOut();

  if (status === 'loading') return <Loading label={t('common.loading')} />;
  if (status === 'unconfigured') return <Notice message={t('account.notConfigured')} />;
  if (status === 'signedOut') {
    return (
      <Card title={t('signIn.title')}>
        <SignInForm />
      </Card>
    );
  }
  return (
    <Card title={t('account.title')}>
      <BodyText>{t('account.signedInAs', { email: session?.user.email ?? '' })}</BodyText>
      <Button
        label={t('account.signOut')}
        onPress={() => signOut.mutate()}
        loading={signOut.isPending}
        testID="sign-out"
      />
    </Card>
  );
}
