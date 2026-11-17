import { lazy, Suspense } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHydrated } from '@/lib/useHydrated';

import { colors } from '../theme';

import type { PinsMapProps } from './types';

// Leaflet needs a browser (window): load it only after hydration, never in the static export.
const LeafletMap = lazy(() => import('./LeafletMap'));

/** Web map: OpenStreetMap tiles through Leaflet, with a price pill per pin. */
export function PinsMap({ pins, onPress, height }: PinsMapProps) {
  const hydrated = useHydrated();
  return (
    <View style={[styles.frame, { height }]} testID="pins-map">
      {hydrated ? (
        <Suspense fallback={null}>
          <LeafletMap pins={pins} onPress={onPress} />
        </Suspense>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
});
