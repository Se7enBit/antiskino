import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** For toggle buttons such as the language switch. */
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  selected = false,
  disabled = false,
  loading = false,
  testID,
}: Props) {
  const filled = variant === 'primary' || selected;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        filled && styles.filled,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.label, filled && styles.filledLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filled: { borderColor: colors.primary, backgroundColor: colors.primary },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  label: { fontSize: 16, color: colors.text },
  filledLabel: { color: colors.onPrimary, fontWeight: '600' },
});
