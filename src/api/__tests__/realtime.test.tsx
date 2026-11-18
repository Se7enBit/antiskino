import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useCampingBookingsLive } from '../realtime';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

function fakeSupabase() {
  let handler: (() => void) | undefined;
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_type: string, _filter: unknown, callback: () => void) => {
      handler = callback;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const client = { channel: jest.fn(() => channel), removeChannel: jest.fn() };
  jest.mocked(getSupabase).mockReturnValue(client as unknown as ReturnType<typeof getSupabase>);
  return { client, channel, fire: () => handler?.() };
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCampingBookingsLive', () => {
  it('refreshes the partner queries when a booking of the camping changes', async () => {
    const { client, channel, fire } = fakeSupabase();
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = await renderHook(() => useCampingBookingsLive('c1'), {
      wrapper: wrapper(queryClient),
    });
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings', filter: 'camping_id=eq.c1' },
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalled();
    fire();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['partner'] });
    await unmount();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('does nothing without a camping', async () => {
    const { client } = fakeSupabase();
    await renderHook(() => useCampingBookingsLive(undefined), {
      wrapper: wrapper(new QueryClient()),
    });
    expect(client.channel).not.toHaveBeenCalled();
  });
});
