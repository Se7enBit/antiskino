import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './theme';

export function Loading({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  label: { fontSize: 15, color: colors.muted },
});
