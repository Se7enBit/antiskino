import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, spacing } from './theme';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessibility labels of the − and + buttons. */
  decreaseLabel: string;
  increaseLabel: string;
  testID: string;
};

/** A number picked with − and + buttons. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  testID,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Button
          label="−"
          onPress={() => onChange(value - 1)}
          disabled={value <= min}
          accessibilityLabel={`${decreaseLabel}: ${label}`}
          testID={`${testID}-minus`}
        />
        <Text style={styles.value} accessibilityLiveRegion="polite" testID={`${testID}-value`}>
          {value}
        </Text>
        <Button
          label="+"
          onPress={() => onChange(value + 1)}
          disabled={value >= max}
          accessibilityLabel={`${increaseLabel}: ${label}`}
          testID={`${testID}-plus`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: { flex: 1, fontSize: 16, color: colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '600', color: colors.text },
});
