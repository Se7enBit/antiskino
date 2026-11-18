import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { colors, spacing } from './theme';

const STAR = '#F5A623';
const SCALE = [1, 2, 3, 4, 5] as const;

/** A 1–5 rating as stars; `label` is what screen readers say ("4 of 5"). */
export function Stars({
  rating,
  label,
  size = 18,
}: {
  rating: number;
  label: string;
  size?: number;
}) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={label}>
      {SCALE.map((n) => (
        <Icon
          key={n}
          name={n <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={n <= Math.round(rating) ? STAR : colors.muted}
        />
      ))}
    </View>
  );
}

type PickerProps = {
  value: number;
  onChange: (rating: number) => void;
  /** Accessible name of each star, e.g. (n) => `${n} stars`. */
  starLabel: (rating: number) => string;
  testID?: string;
};

/** Five tappable stars (44 px targets). */
export function StarPicker({ value, onChange, starLabel, testID }: PickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID={testID}>
      {SCALE.map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={starLabel(n)}
          hitSlop={4}
          style={styles.target}
          testID={testID ? `${testID}-${n}` : undefined}
        >
          <Icon
            name={n <= value ? 'star' : 'star-outline'}
            size={32}
            color={n <= value ? STAR : colors.muted}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  target: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
