import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { canEnter, useMyAccess } from '@/api/access';
import { useAuth } from '@/api/auth';
import { useT } from '@/i18n';
import { BodyText, Button, Card, Loading, Screen, colors } from '@/ui';

type Props = { area: 'partner' | 'admin'; children: ReactNode };

/**
 * Renders the area only for users allowed in: partner members for /partner,
 * platform admins for /admin. RLS enforces the same rules on the data.
 */
export function RequireAccess({ area, children }: Props) {
  const t = useT();
  const { status } = useAuth();
  const access = useMyAccess();

  if (status === 'loading' || (status === 'signedIn' && access.isPending)) {
    return <Loading label={t('common.loading')} />;
  }
  if (status !== 'signedIn') {
    return (
      <Gate title={t('access.signInRequired.title')} body={t('access.signInRequired.body')}>
        <Link href="/account" style={styles.link}>
          {t('access.signInRequired.action')}
        </Link>
      </Gate>
    );
  }
  if (!access.data) {
    return (
      <Gate title={t('access.error')} body={t('signIn.errors.generic')}>
        <Button label={t('common.retry')} onPress={() => void access.refetch()} />
      </Gate>
    );
  }
  if (!canEnter(area, access.data)) {
    return <Gate title={t('access.denied.title')} body={t(`access.denied.${area}`)} />;
  }
  return <>{children}</>;
}

function Gate({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  const t = useT();
  return (
    <Screen>
      <Card title={title}>
        <BodyText>{body}</BodyText>
        {children}
      </Card>
      <Link href="/" style={styles.link}>
        {t('common.backToApp')}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
