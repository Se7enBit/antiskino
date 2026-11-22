import createIconSet from '@expo/vector-icons/createIconSet';
import { View } from 'react-native';

import { useHydrated } from '@/lib/useHydrated';

import { ICON_GLYPHS } from './iconGlyphs';
import { colors } from './theme';

// Material Community Icons with only the icons the app uses (scripts/icon-glyphs.js):
// the full name table is 180 KB in every bundle. Same font file and family name
// as @expo/vector-icons' own MaterialCommunityIcons.
const MaterialCommunityIcons = createIconSet(
  ICON_GLYPHS,
  'material-community',
  require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
);

/** An icon in src/ui/iconGlyphs.ts; add new ones with scripts/icon-glyphs.js. */
export type IconName = keyof typeof ICON_GLYPHS;

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
      // Decorative icons stay out of screen readers. aria-hidden is what the
      // web reads (otherwise the icon font's character became part of every
      // button's name); the other two are the apps' own.
      aria-hidden={!label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
