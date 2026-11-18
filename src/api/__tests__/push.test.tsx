import { renderHook, waitFor } from '@testing-library/react-native';

import { getPushToken } from '@/lib/push';
import { getSupabase } from '@/lib/supabase';

import { unregisterPush, usePushRegistration } from '../push';

jest.mock('@/lib/push', () => ({ getPushToken: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const rpc = jest.fn(() => Promise.resolve({ error: null }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSupabase).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabase>);
});

describe('push registration', () => {
  it('registers the device of a signed-in user, and removes it on sign-out', async () => {
    jest
      .mocked(getPushToken)
      .mockResolvedValue({ token: 'ExponentPushToken[abc]', platform: 'android' });
    await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('register_push_token', {
        p_token: 'ExponentPushToken[abc]',
        p_platform: 'android',
      }),
    );
    await unregisterPush();
    expect(rpc).toHaveBeenLastCalledWith('unregister_push_token', {
      p_token: 'ExponentPushToken[abc]',
    });
    rpc.mockClear();
    await unregisterPush();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does nothing when signed out or without a token', async () => {
    jest.mocked(getPushToken).mockResolvedValue(null);
    await renderHook(() => usePushRegistration(undefined));
    expect(getPushToken).not.toHaveBeenCalled();
    await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(getPushToken).toHaveBeenCalled());
    expect(rpc).not.toHaveBeenCalled();
  });
});
