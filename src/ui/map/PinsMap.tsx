import { lazy, Suspense } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHydrated } from '@/lib/useHydrated';

import { colors } from '../theme';

import type { PinsMapProps } from './types';

// MapLibre needs a browser (window, WebGL): load it only after hydration, never in the static export.
const MapLibreWebMap = lazy(() => import('./MapLibreWebMap'));

/** Web map: MapLibre with OpenFreeMap's OpenStreetMap style, with a label per pin. */
export function PinsMap({ pins, onPress, height }: PinsMapProps) {
  const hydrated = useHydrated();
  return (
    <View style={[styles.frame, { height }]} testID="pins-map">
      {hydrated ? (
        <Suspense fallback={null}>
          {/* A new set of pins creates a new map, fitted to them. */}
          <MapLibreWebMap
            key={pins.map((p) => `${p.id}@${p.lat},${p.lng}:${p.label}`).join('|')}
            pins={pins}
            onPress={onPress}
          />
        </Suspense>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
});
