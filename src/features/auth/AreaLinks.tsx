import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { canEnter, useMyAccess } from '@/api/access';
import { useT } from '@/i18n';
import { SectionLabel, colors, spacing } from '@/ui';

/** Links to the partner and admin areas, shown only to users who may enter them. */
export function AreaLinks() {
  const t = useT();
  const { data: access } = useMyAccess();
  if (!access) return null;
  const partner = canEnter('partner', access);
  const admin = canEnter('admin', access);
  if (!partner && !admin) return null;
  return (
    <View style={styles.section}>
      <SectionLabel>{t('account.areas')}</SectionLabel>
      {partner ? (
        <Link href="/partner" style={styles.link}>
          {t('account.partnerArea')}
        </Link>
      ) : null}
      {admin ? (
        <Link href="/admin" style={styles.link}>
          {t('account.adminArea')}
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', paddingVertical: spacing.xs },
});
