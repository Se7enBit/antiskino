import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useAuth, useSignOut } from '@/api/auth';
import { useAcceptInvite } from '@/api/invites';
import { SignInForm } from '@/features/auth/SignInForm';
import { PageHead } from '@/features/common/PageHead';
import { useT } from '@/i18n';
import { BodyText, Button, Card, Loading, Notice, Screen, colors } from '@/ui';

const MESSAGES = {
  used: 'invite.used',
  expired: 'invite.expired',
  invalid: 'invite.invalid',
  wrong_email: 'invite.wrongEmail',
} as const;

/** /invite?t=<token>: sign in if needed, then join the partner's team. */
export function AcceptInvite({ token }: { token: string | undefined }) {
  const t = useT();
  const { status } = useAuth();
  const accept = useAcceptInvite();
  const signOut = useSignOut();

  if (status === 'loading') return <Loading label={t('common.loading')} />;

  const body = () => {
    if (status === 'unconfigured') return <Notice message={t('account.notConfigured')} />;
    if (!token) return <BodyText>{t('invite.invalid')}</BodyText>;
    if (status === 'signedOut') {
      return (
        <>
          <BodyText>{t('invite.signInFirst')}</BodyText>
          <SignInForm />
        </>
      );
    }
    const result = accept.data;
    if (result?.status === 'accepted') {
      return (
        <>
          <BodyText>{t('invite.accepted')}</BodyText>
          <Link href="/partner" style={styles.link}>
            {t('invite.openPartnerArea')}
          </Link>
        </>
      );
    }
    if (result) {
      return (
        <>
          <Notice tone="error" message={t(MESSAGES[result.status])} />
          {result.status === 'wrong_email' ? (
            <Button
              label={t('account.signOut')}
              onPress={() => signOut.mutate()}
              testID="invite-sign-out"
            />
          ) : null}
        </>
      );
    }
    return (
      <>
        <BodyText>{t('invite.intro')}</BodyText>
        <Button
          label={t('invite.accept')}
          variant="primary"
          onPress={() => accept.mutate(token)}
          loading={accept.isPending}
          testID="invite-accept"
        />
        {accept.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      </>
    );
  };

  return (
    <Screen>
      <PageHead title={`${t('invite.title')} · Antiskino`} />
      <Card title={t('invite.title')}>{body()}</Card>
      <Link href="/" style={styles.link}>
        {t('common.backToApp')}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
