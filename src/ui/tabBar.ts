import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Bottom tab bars on phones (customer and partner areas). The navigation
 * library sizes the label row for 10 px text: with larger labels and no line
 * height, the bottoms of the letters were cut off.
 */
// Web only: in the apps the library adds the phone's gesture-bar inset to its
// own height, which a fixed height would replace.
export const phoneTabBarStyle: ViewStyle =
  Platform.OS === 'web' ? { height: 60, paddingTop: 4 } : {};

export function tabLabelStyle(fontSize: number): TextStyle {
  return { fontSize, lineHeight: Math.round(fontSize * 1.35), fontWeight: '600' };
}
