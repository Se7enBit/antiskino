import { render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuth } from '@/api/auth';
import { usePushRegistration } from '@/api/push';
import { onPushTap } from '@/lib/push';

import { PushSetup } from '../PushSetup';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/push', () => ({ usePushRegistration: jest.fn() }));
jest.mock('@/lib/push', () => ({ onPushTap: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('PushSetup', () => {
  it('registers the signed-in user and opens the booking of a tapped push', async () => {
    jest.mocked(useAuth).mockReturnValue({
      status: 'signedIn',
      session: { user: { id: 'user-1' } } as never,
    });
    let tap: ((data: unknown) => void) | undefined;
    const stop = jest.fn();
    jest.mocked(onPushTap).mockImplementation((fn) => {
      tap = fn;
      return stop;
    });
    const { unmount } = await render(<PushSetup />);
    expect(usePushRegistration).toHaveBeenCalledWith('user-1');
    tap?.({ url: '/partner/bookings/detail?ref=ANT-7KQ2XM' });
    expect(router.push).toHaveBeenCalledWith('/partner/bookings/detail?ref=ANT-7KQ2XM');
    tap?.({ url: 'https://example.com' });
    expect(router.push).toHaveBeenCalledTimes(1);
    await unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('registers nobody when signed out', async () => {
    jest.mocked(useAuth).mockReturnValue({ status: 'signedOut', session: null });
    jest.mocked(onPushTap).mockReturnValue(() => undefined);
    await render(<PushSetup />);
    expect(usePushRegistration).toHaveBeenCalledWith(undefined);
  });
});
