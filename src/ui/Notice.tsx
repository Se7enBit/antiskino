import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './theme';

type Props = { message: string; tone?: 'info' | 'error' };

export function Notice({ message, tone = 'info' }: Props) {
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.notice, tone === 'error' && styles.error]}
    >
      <Text style={[styles.text, tone === 'error' && styles.errorText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: spacing.md, borderRadius: 8, backgroundColor: colors.surface },
  error: { backgroundColor: colors.dangerSurface },
  text: { fontSize: 15, lineHeight: 21, color: colors.text },
  errorText: { color: colors.danger },
});
