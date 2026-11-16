import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
};

export function Button({ label, onPress, selected = false, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
  label: { fontSize: 16, color: colors.text },
  selectedLabel: { color: colors.onPrimary, fontWeight: '600' },
});
