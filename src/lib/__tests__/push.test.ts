import Constants from 'expo-constants';
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getExpoPushTokenAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';

import { getPushToken, onPushTap } from '../push.native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } },
}));

const config = Constants as unknown as { expoConfig: { extra: { eas: { projectId?: string } } } };

beforeEach(() => {
  jest.clearAllMocks();
  config.expoConfig.extra.eas.projectId = 'project-1';
});

describe('getPushToken', () => {
  it('asks permission and returns the Expo push token for the EAS project', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce({ status: 'granted' } as never);
    jest
      .mocked(getExpoPushTokenAsync)
      .mockResolvedValueOnce({ type: 'expo', data: 'ExponentPushToken[abc]' });
    await expect(getPushToken()).resolves.toEqual({
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
  });

  it('returns null when permission is refused', async () => {
    await expect(getPushToken()).resolves.toBeNull();
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null without an EAS project, without asking', async () => {
    delete config.expoConfig.extra.eas.projectId;
    await expect(getPushToken()).resolves.toBeNull();
    expect(getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when the token cannot be had (e.g. Expo Go)', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValueOnce({ status: 'granted' } as never);
    await expect(getPushToken()).resolves.toBeNull();
  });
});

describe('onPushTap', () => {
  const response = (url: string) =>
    ({ notification: { request: { content: { data: { url } } } } }) as never;

  it('passes on the push that opened the app, then each tapped push', () => {
    jest.mocked(getLastNotificationResponse).mockReturnValueOnce(response('/a'));
    const remove = jest.fn();
    let listener: ((r: never) => void) | undefined;
    jest.mocked(addNotificationResponseReceivedListener).mockImplementationOnce((fn) => {
      listener = fn as (r: never) => void;
      return { remove } as never;
    });
    const onData = jest.fn();
    const stop = onPushTap(onData);
    expect(onData).toHaveBeenCalledWith({ url: '/a' });
    expect(clearLastNotificationResponse).toHaveBeenCalled();
    listener?.(response('/b'));
    expect(onData).toHaveBeenLastCalledWith({ url: '/b' });
    stop();
    expect(remove).toHaveBeenCalled();
  });
});
