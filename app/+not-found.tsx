import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PageHead } from '@/features/common/PageHead';
import { useT } from '@/i18n';
import { Placeholder, colors } from '@/ui';

export default function NotFoundScreen() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('notFound.title') }} />
      <PageHead title={`${t('notFound.title')} · Antiskino`} />
      <Placeholder title={t('notFound.title')} body={t('notFound.body')}>
        <Link href="/" style={styles.link}>
          {t('common.backToApp')}
        </Link>
      </Placeholder>
    </>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
