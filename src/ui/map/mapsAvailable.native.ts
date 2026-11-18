import Constants from 'expo-constants';
import { Platform } from 'react-native';

type AndroidConfig = { config?: { googleMaps?: { apiKey?: unknown } } };

/**
 * Whether this build can show maps. iOS uses Apple Maps; Android's Google Maps
 * needs an API key in the build (app.json android.config.googleMaps.apiKey),
 * and crashes without one, so Android builds without a key show no maps.
 */
export const mapsAvailable =
  Platform.OS !== 'android' ||
  Boolean((Constants.expoConfig?.android as AndroidConfig | undefined)?.config?.googleMaps?.apiKey);
