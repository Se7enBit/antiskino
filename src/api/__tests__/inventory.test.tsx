import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase';

import { useSetClosed } from '../inventory';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const values = { pitchTypeIds: ['pt1', 'pt2'], firstNight: '2027-08-15', lastNight: '2027-08-16' };

async function setup(results: { data: number | null; error: unknown }[]) {
  const rpc = jest.fn();
  for (const result of results) rpc.mockResolvedValueOnce(result);
  jest.mocked(getSupabase).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabase>);
  const client = new QueryClient({
    // No retries, and no garbage-collection timer to keep Jest running.
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useSetClosed(), { wrapper });
  return { rpc, result };
}

describe('useSetClosed', () => {
  it('calls set_closed for each pitch type and adds up the nights', async () => {
    const { rpc, result } = await setup([
      { data: 2, error: null },
      { data: 1, error: null },
    ]);
    let changed: number | undefined;
    await act(async () => {
      changed = await result.current.mutateAsync({ values, closed: true });
    });
    expect(changed).toBe(3);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith('set_closed', {
      p_pitch_type_id: 'pt2',
      p_first_night: '2027-08-15',
      p_last_night: '2027-08-16',
      p_closed: true,
    });
  });

  it('stops at the first failure', async () => {
    const failure = { code: '42501', message: 'no' };
    const { rpc, result } = await setup([{ data: null, error: failure }]);
    await act(async () => {
      await expect(result.current.mutateAsync({ values, closed: false })).rejects.toBe(failure);
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
