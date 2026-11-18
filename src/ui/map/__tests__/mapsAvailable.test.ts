import { Platform } from 'react-native';

function load(os: 'ios' | 'android', apiKey?: string): boolean {
  let available = false;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { android: apiKey ? { config: { googleMaps: { apiKey } } } : {} } },
    }));
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated per case
      available = (require('../mapsAvailable.native') as { mapsAvailable: boolean }).mapsAvailable;
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
  return available;
}

describe('mapsAvailable', () => {
  it('is true on iOS (Apple Maps)', () => {
    expect(load('ios')).toBe(true);
  });

  it('needs a Google Maps key on Android', () => {
    expect(load('android')).toBe(false);
    expect(load('android', 'AIza-test')).toBe(true);
  });
});
