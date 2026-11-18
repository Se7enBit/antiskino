import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { BodyText, Button, Screen, colors, spacing } from '@/ui';

/** Shown instead of a blank page when a screen fails unexpectedly. */
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        {t('common.crash.title')}
      </Text>
      <BodyText>{t('common.crash.body')}</BodyText>
      <View style={styles.row}>
        <Button
          label={t('common.retry')}
          variant="primary"
          onPress={onRetry}
          testID="crash-retry"
        />
        <Button label={t('common.crash.home')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
