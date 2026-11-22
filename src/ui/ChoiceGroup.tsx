import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { spacing } from './theme';

type Option<T extends string> = { value: T; label: string; disabled?: boolean };

type Props<T extends string> = {
  options: Option<T>[];
  /** One value for single choice, an array for multiple choice. */
  selected: T | readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
  testID?: string;
};

/** A wrap-around row of toggle buttons. */
export function ChoiceGroup<T extends string>({
  options,
  selected,
  onChange,
  disabled,
  testID,
}: Props<T>) {
  const multiple = Array.isArray(selected);
  const isSelected = (value: T) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;
  return (
    // Screen readers: one choice is a radio group; several are checkboxes.
    <View style={styles.row} accessibilityRole={multiple ? 'none' : 'radiogroup'}>
      {options.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          choice={multiple ? 'checkbox' : 'radio'}
          selected={isSelected(option.value)}
          disabled={disabled || option.disabled}
          onPress={() => onChange(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
