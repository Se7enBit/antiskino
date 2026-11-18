import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useT } from '@/i18n';
import { colors, spacing } from '@/ui';

/** Header link from the partner area back to the customer app. */
export function ExitLink() {
  const t = useT();
  return (
    <Link href="/account" style={styles.exit}>
      {t('partner.exit')}
    </Link>
  );
}

const styles = StyleSheet.create({
  exit: { color: colors.primary, fontSize: 16, fontWeight: '600', paddingHorizontal: spacing.md },
});
