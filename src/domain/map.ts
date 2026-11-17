/** A point on the map for one camping. */
export type Pin = { id: string; lat: number; lng: number; title: string; label: string };

/** Greece, for an empty map. */
export const GREECE = { lat: 38.6, lng: 23.6 };

/** Campings with coordinates become pins; the rest can't be shown on a map. */
export function pinsOf<T>(
  items: T[],
  where: (item: T) => { lat: number | null; lng: number | null },
  toPin: (item: T, lat: number, lng: number) => Pin,
): Pin[] {
  return items.flatMap((item) => {
    const { lat, lng } = where(item);
    return lat !== null && lng !== null ? [toPin(item, lat, lng)] : [];
  });
}

/**
 * The region that shows every pin with some margin (react-native-maps). One
 * pin gets a close-up; no pins show Greece.
 */
export function regionFor(pins: Pin[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  if (pins.length === 0)
    return { latitude: GREECE.lat, longitude: GREECE.lng, latitudeDelta: 7, longitudeDelta: 7 };
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [
    Math.min(...lats),
    Math.max(...lats),
    Math.min(...lngs),
    Math.max(...lngs),
  ];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // 40% margin, and never closer than about 2 km
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
  };
}

/** South-west and north-east corners around the pins (Leaflet), or null for none. */
export function boundsFor(pins: Pin[]): [[number, number], [number, number]] | null {
  if (pins.length === 0) return null;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = regionFor(pins);
  return [
    [latitude - latitudeDelta / 2, longitude - longitudeDelta / 2],
    [latitude + latitudeDelta / 2, longitude + longitudeDelta / 2],
  ];
}
