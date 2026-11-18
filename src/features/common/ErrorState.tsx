import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Button, Notice, spacing } from '@/ui';

/** A failed load: what happened and a retry button. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <View style={styles.block}>
      <Notice tone="error" message={t('common.error')} />
      <View style={styles.row}>
        <Button label={t('common.retry')} onPress={onRetry} testID="retry" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
