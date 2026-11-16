import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, useLanguage, useT } from '@/i18n';
import { Button, Placeholder, colors, spacing } from '@/ui';

export default function AccountScreen() {
  const t = useT();
  const { language: active, setLanguage } = useLanguage();

  return (
    <Placeholder title={t('account.title')} body={t('account.body')}>
      <View style={styles.section}>
        <Text style={styles.heading}>{t('account.language')}</Text>
        <View style={styles.row}>
          {LANGUAGES.map((language) => (
            <Button
              key={language}
              label={t(`account.languages.${language}`)}
              selected={language === active}
              onPress={() => setLanguage(language)}
              testID={`language-${language}`}
            />
          ))}
        </View>
      </View>
      {/* Shown to everyone until sign-in exists; gated by role from M2/M4. */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('account.areas')}</Text>
        <Link href="/partner" style={styles.link}>
          {t('account.partnerArea')}
        </Link>
        <Link href="/admin" style={styles.link}>
          {t('account.adminArea')}
        </Link>
      </View>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { fontSize: 14, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', paddingVertical: spacing.xs },
});
