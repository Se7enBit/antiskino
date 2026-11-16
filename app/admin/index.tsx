import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useT } from '@/i18n';
import { Placeholder, colors } from '@/ui';

// Partners & campings (M2).
export default function AdminHomeScreen() {
  const t = useT();
  return (
    <Placeholder title={t('admin.title')} body={t('admin.body')}>
      <Link href="/" style={styles.link}>
        {t('common.backToApp')}
      </Link>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
