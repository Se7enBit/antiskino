/**
 * Push notifications on the web: none (Expo push is for the iOS and Android
 * apps). push.native.ts is the real implementation.
 */
export type DeviceToken = { token: string; platform: 'ios' | 'android' };

/** This device's Expo push token, asking permission first; null where push isn't available. */
export function getPushToken(): Promise<DeviceToken | null> {
  return Promise.resolve(null);
}

/** Calls `onData` with the data of each tapped push (and the one that opened the app). */
export function onPushTap(_onData: (data: unknown) => void): () => void {
  return () => undefined;
}
