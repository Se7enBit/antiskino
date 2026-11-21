import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useAuth } from '@/api/auth';
import {
  mergeFavorites,
  useFavoriteCampings,
  useServerFavorites,
  useToggleServerFavorite,
} from '@/api/favorites';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { FavoritesScreen } from '../FavoritesScreen';
import { useDeviceFavorites } from '../favoritesStore';
import { useFavorites, useMergeDeviceFavorites } from '../useFavorites';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/photos', () => ({ photoUrl: (path: string) => `https://cdn.test/${path}` }));
jest.mock('@/api/favorites', () => ({
  useServerFavorites: jest.fn(),
  useToggleServerFavorite: jest.fn(),
  useFavoriteCampings: jest.fn(),
  mergeFavorites: jest.fn(),
}));

const A = 'a0000000-0000-4000-8000-0000000000a1';
const B = 'b0000000-0000-4000-8000-0000000000b1';
const toggleServer = jest.fn();

function signedIn(ids: string[] | null) {
  jest
    .mocked(useAuth)
    .mockReturnValue(
      ids
        ? { status: 'signedIn', session: { user: { id: 'u1' } } as never }
        : { status: 'signedOut', session: null },
    );
  jest
    .mocked(useServerFavorites)
    .mockReturnValue({ data: ids ?? undefined } as unknown as ReturnType<
      typeof useServerFavorites
    >);
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  jest.clearAllMocks();
  useDeviceFavorites.setState({ ids: [] });
  jest
    .mocked(useToggleServerFavorite)
    .mockReturnValue({ mutate: toggleServer } as unknown as ReturnType<
      typeof useToggleServerFavorite
    >);
  await i18n.changeLanguage('en');
});

describe('device favorites', () => {
  it('saves newest first and removes again', () => {
    useDeviceFavorites.getState().toggle(A);
    useDeviceFavorites.getState().toggle(B);
    expect(useDeviceFavorites.getState().ids).toEqual([B, A]);
    useDeviceFavorites.getState().toggle(A);
    expect(useDeviceFavorites.getState().ids).toEqual([B]);
  });
});

describe('useFavorites', () => {
  it('keeps a guest’s favorites on the device', async () => {
    signedIn(null);
    const { result } = await renderHook(() => useFavorites());
    await act(() => result.current.toggle(A));
    expect(useDeviceFavorites.getState().ids).toEqual([A]);
    expect(toggleServer).not.toHaveBeenCalled();
  });

  it('keeps a signed-in user’s favorites in the account', async () => {
    signedIn([A]);
    const { result } = await renderHook(() => useFavorites());
    expect(result.current.isFavorite(A)).toBe(true);
    await act(() => result.current.toggle(A));
    expect(toggleServer).toHaveBeenCalledWith({ campingId: A, saved: true });
    await act(() => result.current.toggle(B));
    expect(toggleServer).toHaveBeenLastCalledWith({ campingId: B, saved: false });
    expect(useDeviceFavorites.getState().ids).toEqual([]);
  });

  it('moves the device’s favorites into the account on sign-in', async () => {
    useDeviceFavorites.setState({ ids: [A, B] });
    jest.mocked(mergeFavorites).mockResolvedValue(undefined);
    signedIn([]);
    await renderHook(() => useMergeDeviceFavorites(), { wrapper });
    expect(mergeFavorites).toHaveBeenCalledWith([A, B]);
    await waitFor(() => expect(useDeviceFavorites.getState().ids).toEqual([]));
  });

  it('keeps them on the device when merging fails', async () => {
    useDeviceFavorites.setState({ ids: [A] });
    jest.mocked(mergeFavorites).mockRejectedValue(new Error('offline'));
    signedIn([]);
    await renderHook(() => useMergeDeviceFavorites(), { wrapper });
    await waitFor(() => expect(mergeFavorites).toHaveBeenCalled());
    expect(useDeviceFavorites.getState().ids).toEqual([A]);
  });
});

describe('Favorites tab', () => {
  function campings(list: { id: string; slug: string; name: string }[]) {
    jest.mocked(useFavoriteCampings).mockReturnValue({
      isPending: false,
      isError: false,
      data: list.map((c) => ({
        ...c,
        region: 'Πήλιο',
        status: 'live',
        camping_photos: [],
        coverPhoto: null,
      })),
    } as unknown as ReturnType<typeof useFavoriteCampings>);
  }

  it('explains the heart, and suggests signing in', async () => {
    signedIn(null);
    campings([]);
    await renderWithLanguage(<FavoritesScreen />);
    expect(screen.getByText('Campings you save with the heart will appear here.')).toBeTruthy();
    expect(screen.getByText('Sign in to keep your favorites on all your devices.')).toBeTruthy();
  });

  it('lists saved campings, opens them and removes them', async () => {
    signedIn([A]);
    campings([{ id: A, slug: 'thalassa', name: 'Camping Thalassa' }]);
    await renderWithLanguage(<FavoritesScreen />);
    expect(useFavoriteCampings).toHaveBeenLastCalledWith([A]);
    expect(screen.queryByText('Sign in to keep your favorites on all your devices.')).toBeNull();
    await fireEvent.press(screen.getByTestId('favorite-camping-thalassa'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/en/c/[slug]',
      params: { slug: 'thalassa' },
    });
    const heart = screen.getByLabelText('Remove Camping Thalassa from favorites');
    expect(heart.props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(heart);
    expect(toggleServer).toHaveBeenCalledWith({ campingId: A, saved: true });
  });
});
