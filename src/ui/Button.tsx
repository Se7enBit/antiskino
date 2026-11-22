import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from './Icon';
import { colors, spacing } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** For toggle buttons such as the language switch. */
  selected?: boolean;
  /**
   * In a group of choices: 'radio' (pick one) or 'checkbox' (pick several), so
   * screen readers say which are chosen ("checked") instead of a plain button.
   */
  choice?: 'radio' | 'checkbox';
  /** For a button that shows or hides something (e.g. the calendar). */
  expanded?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** An icon before the label. */
  icon?: IconName;
  /** When the label alone doesn't say what the button does (e.g. "+"). */
  accessibilityLabel?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  selected = false,
  choice,
  expanded,
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  testID,
}: Props) {
  const filled = variant === 'primary' || selected;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole={choice ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={
        choice
          ? { checked: selected, disabled: inactive, busy: loading, expanded }
          : { selected, disabled: inactive, busy: loading, expanded }
      }
      // The web reads only aria-* (accessibilityState is the apps' own).
      aria-checked={choice ? selected : undefined}
      aria-expanded={expanded}
      aria-busy={loading || undefined}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        icon && styles.withIcon,
        filled && styles.filled,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={filled ? colors.onPrimary : colors.text} /> : null}
          <Text style={[styles.label, filled && styles.filledLabel]}>{label}</Text>
        </>
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
    // A label that wraps (long Greek words, narrow cards) makes the button taller.
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  withIcon: { flexDirection: 'row', gap: spacing.sm },
  filled: { borderColor: colors.primary, backgroundColor: colors.primary },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  label: { fontSize: 16, color: colors.text, textAlign: 'center', flexShrink: 1 },
  filledLabel: { color: colors.onPrimary, fontWeight: '600' },
});
