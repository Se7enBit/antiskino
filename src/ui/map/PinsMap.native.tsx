import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { regionFor } from '@/domain/map';

import { colors } from '../theme';

import type { PinsMapProps } from './types';

/** Native map (Apple Maps on iOS, Google Maps on Android) with one marker per pin. */
export function PinsMap({ pins, onPress, height }: PinsMapProps) {
  return (
    <View style={[styles.frame, { height }]}>
      <MapView
        // initialRegion applies on mount: a new set of pins remounts the map.
        key={pins.map((p) => p.id).join()}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(pins)}
        testID="pins-map"
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            title={pin.title}
            description={pin.label}
            onCalloutPress={() => onPress?.(pin.id)}
            testID={`pin-${pin.id}`}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
});
