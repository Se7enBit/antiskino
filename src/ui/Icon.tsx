import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useHydrated } from '@/lib/useHydrated';

import { colors } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** A Material Community icon; decorative unless given a label. */
export function Icon({
  name,
  size = 20,
  color = colors.text,
  label,
}: {
  name: IconName;
  size?: number;
  color?: string;
  label?: string;
}) {
  // The icon font loads in the browser: keep the static HTML and the first
  // render identical (a blank of the same size) to avoid hydration errors.
  const hydrated = useHydrated();
  if (!hydrated) return <View style={{ width: size, height: size }} />;
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
