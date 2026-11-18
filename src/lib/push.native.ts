import Constants from 'expo-constants';
import {
  AndroidImportance,
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getExpoPushTokenAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { DeviceToken } from './push';

export type { DeviceToken } from './push';

// Show pushes that arrive while the app is open too.
setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

/** The EAS project the Expo push service issues tokens for (set by `eas init`). */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : undefined;
}

export async function getPushToken(): Promise<DeviceToken | null> {
  const projectId = easProjectId();
  if (!projectId) return null;
  try {
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('default', {
        name: 'Antiskino',
        importance: AndroidImportance.HIGH,
      });
    }
    let { status } = await getPermissionsAsync();
    if (status !== 'granted') ({ status } = await requestPermissionsAsync());
    if (status !== 'granted') return null;
    const { data } = await getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch {
    // No push in Expo Go or without Google Play services: carry on without it.
    return null;
  }
}

export function onPushTap(onData: (data: unknown) => void): () => void {
  const opened = getLastNotificationResponse();
  if (opened) {
    clearLastNotificationResponse();
    onData(opened.notification.request.content.data);
  }
  const subscription = addNotificationResponseReceivedListener((response) => {
    onData(response.notification.request.content.data);
  });
  return () => subscription.remove();
}
