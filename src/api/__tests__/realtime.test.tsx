import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useCampingBookingsLive } from '../realtime';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

type FakeChannel = { name: string; on: jest.Mock; subscribe: jest.Mock };

/**
 * Like supabase-js: channel(name) returns the existing channel of that name
 * until its removal completes (removeChannel is async), and a subscribed
 * channel refuses new callbacks.
 */
function fakeSupabase() {
  let handler: (() => void) | undefined;
  const byName = new Map<string, FakeChannel>();
  const created: FakeChannel[] = [];
  const client = {
    channel: jest.fn((name: string) => {
      const existing = byName.get(name);
      if (existing) return existing;
      let subscribed = false;
      const channel: FakeChannel = {
        name,
        on: jest.fn((_type: string, _filter: unknown, callback: () => void) => {
          if (subscribed) throw new Error(`cannot add callbacks for ${name} after subscribe()`);
          handler = callback;
          return channel;
        }),
        subscribe: jest.fn(() => {
          subscribed = true;
          return channel;
        }),
      };
      byName.set(name, channel);
      created.push(channel);
      return channel;
    }),
    // Still pending when the effect runs again.
    removeChannel: jest.fn(() => new Promise<void>(() => undefined)),
  };
  jest.mocked(getSupabase).mockReturnValue(client as unknown as ReturnType<typeof getSupabase>);
  return { client, created, fire: () => handler?.() };
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCampingBookingsLive', () => {
  it('refreshes the partner queries when a booking of the camping changes', async () => {
    const { client, created, fire } = fakeSupabase();
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = await renderHook(() => useCampingBookingsLive('c1'), {
      wrapper: wrapper(queryClient),
    });
    const channel = created[0]!;
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

  it('subscribes again after a remount while the old channel is still being removed', async () => {
    const { created } = fakeSupabase();
    const queryClient = new QueryClient();
    const first = await renderHook(() => useCampingBookingsLive('c1'), {
      wrapper: wrapper(queryClient),
    });
    await first.unmount();
    await renderHook(() => useCampingBookingsLive('c1'), { wrapper: wrapper(queryClient) });
    expect(created).toHaveLength(2);
    expect(created[0]!.name).not.toBe(created[1]!.name);
    expect(created[1]!.subscribe).toHaveBeenCalled();
  });

  it('does nothing without a camping', async () => {
    const { client } = fakeSupabase();
    await renderHook(() => useCampingBookingsLive(undefined), {
      wrapper: wrapper(new QueryClient()),
    });
    expect(client.channel).not.toHaveBeenCalled();
  });
});
