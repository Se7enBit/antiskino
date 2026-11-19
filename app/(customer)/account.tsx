import { StyleSheet, View } from 'react-native';

import { AccountSignIn } from '@/features/auth/AccountSignIn';
import { AreaLinks } from '@/features/auth/AreaLinks';
import { DeleteAccount } from '@/features/auth/DeleteAccount';
import { EmailSettings } from '@/features/auth/EmailSettings';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { LANGUAGES, useLanguage, useT } from '@/i18n';
import { Button, Screen, SectionLabel, spacing } from '@/ui';

export default function AccountScreen() {
  const t = useT();
  const { language: active, setLanguage } = useLanguage();

  return (
    <Screen>
      <AccountSignIn />
      <View style={styles.section}>
        <SectionLabel>{t('account.language')}</SectionLabel>
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
      <AreaLinks />
      <EmailSettings />
      <LegalLinks label />
      <DeleteAccount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
