import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { lngLatBoundsFor } from '@/domain/map';

import { colors, spacing } from '../theme';

import type { PinsMapProps } from './types';

/** OpenFreeMap's OpenStreetMap style: free, no account and no key. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Native map (MapLibre with OpenStreetMap data) with a label pin per camping. */
export function PinsMap({ pins, onPress, height }: PinsMapProps) {
  return (
    <View style={[styles.frame, { height }]}>
      <Map
        // initialViewState applies on mount: a new set of pins remounts the map.
        key={pins.map((p) => p.id).join()}
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        logo={false}
        testID="pins-map"
      >
        <Camera initialViewState={{ bounds: lngLatBoundsFor(pins) }} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            id={pin.id}
            lngLat={[pin.lng, pin.lat]}
            anchor="bottom"
            onPress={() => onPress?.(pin.id)}
          >
            <View
              accessible
              accessibilityRole={onPress ? 'button' : undefined}
              accessibilityLabel={
                pin.title === pin.label ? pin.title : `${pin.title}, ${pin.label}`
              }
              style={styles.pin}
              testID={`pin-${pin.id}`}
            >
              <Text style={styles.pinText} numberOfLines={1}>
                {pin.label}
              </Text>
            </View>
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  pin: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    backgroundColor: colors.primary,
    maxWidth: 180,
  },
  pinText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
});
