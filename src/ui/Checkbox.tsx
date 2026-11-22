import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from './Icon';
import { colors, spacing } from './theme';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
};

export function Checkbox({ label, checked, onChange, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={styles.row}
      testID={testID}
    >
      <Icon
        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={24}
        color={checked ? colors.primary : colors.muted}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  label: { flex: 1, fontSize: 16, color: colors.text },
});
