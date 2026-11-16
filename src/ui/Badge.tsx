import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './theme';

type Tone = 'neutral' | 'success' | 'warning';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, tone === 'success' && styles.successText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  neutral: { backgroundColor: colors.border },
  success: { backgroundColor: colors.primary },
  warning: { backgroundColor: colors.warningSurface },
  text: { fontSize: 13, fontWeight: '600', color: colors.text },
  successText: { color: colors.onPrimary },
});
