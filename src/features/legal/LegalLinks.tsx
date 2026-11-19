import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { SectionLabel, colors, spacing } from '@/ui';

/** Links to the terms and the privacy policy; with a label on the Account tab. */
export function LegalLinks({ label = false }: { label?: boolean }) {
  const t = useT();
  return (
    <View style={styles.section}>
      {label ? <SectionLabel>{t('legal.area')}</SectionLabel> : null}
      <View style={styles.row}>
        <Link href="/terms" style={styles.link}>
          {t('legal.terms.title')}
        </Link>
        <Link href="/privacy" style={styles.link}>
          {t('legal.privacy.title')}
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', paddingVertical: spacing.xs },
});
