import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useT } from '@/i18n';
import { Placeholder, colors } from '@/ui';

// Today screen (M5).
export default function PartnerTodayScreen() {
  const t = useT();
  return (
    <Placeholder title={t('partner.title')} body={t('partner.body')}>
      <Link href="/" style={styles.link}>
        {t('common.backToApp')}
      </Link>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
