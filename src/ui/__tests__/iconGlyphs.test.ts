import fullGlyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { ICON_GLYPHS } from '../iconGlyphs';

describe('ICON_GLYPHS', () => {
  it("matches the Material Community font's codes (regenerate with scripts/icon-glyphs.js)", () => {
    const full = fullGlyphMap as Record<string, number>;
    for (const [name, code] of Object.entries(ICON_GLYPHS))
      expect([name, code]).toEqual([name, full[name]]);
  });
});
