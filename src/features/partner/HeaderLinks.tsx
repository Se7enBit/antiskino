import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Icon, colors, spacing } from '@/ui';

/** Partner header, right side: the guide (a small "?") and the way back to the customer app. */
export function HeaderLinks() {
  const t = useT();
  return (
    <View style={styles.row}>
      <Link href="/partner/guide" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('partner.guide.open')}
          hitSlop={8}
          style={styles.guide}
          testID="partner-guide-link"
        >
          <Icon name="help-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </Link>
      <Link href="/account" style={styles.exit}>
        {t('partner.exit')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  guide: { padding: spacing.xs },
  exit: { color: colors.primary, fontSize: 16, fontWeight: '600', paddingHorizontal: spacing.md },
});
