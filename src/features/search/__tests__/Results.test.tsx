import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useSearch, type SearchResult } from '@/api/search';
import { DEFAULT_QUERY } from '@/domain/search';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { ResultsScreen } from '../ResultsScreen';
import { useSearchStore } from '../searchStore';

jest.mock('@/features/favorites/useFavorites', () => ({
  useFavorites: () => ({
    ids: [],
    ready: true,
    signedIn: false,
    isFavorite: () => false,
    toggle: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/api/search', () => ({ useSearch: jest.fn() }));
jest.mock('@/api/photos', () => ({ photoUrl: (path: string) => `https://cdn.test/${path}` }));

const PARAMS = {
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: '2',
  children: '7',
  equipment: 'tent',
};

const result = (
  slug: string,
  fromTotalCents: number,
  patch: Partial<SearchResult['camping']> = {},
): SearchResult => ({
  camping: {
    id: slug,
    slug,
    name: slug.toUpperCase(),
    region: 'Χαλκιδική',
    lat: null,
    lng: null,
    shortDescr: { en: 'By the sea' },
    coverPhoto: `${slug}/cover.jpg`,
    rating: null,
    ...patch,
  },
  fromTotalCents,
  pitchTypes: [{ id: `${slug}-tent`, totalCents: fromTotalCents }],
});

async function setup(
  params: Record<string, string>,
  search: Partial<ReturnType<typeof useSearch>>,
) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  const refetch = jest.fn();
  jest
    .mocked(useSearch)
    .mockReturnValue({ refetch, ...search } as unknown as ReturnType<typeof useSearch>);
  await renderWithLanguage(<ResultsScreen />);
  return { refetch };
}

beforeEach(async () => {
  jest.clearAllMocks();
  useSearchStore.setState({ query: DEFAULT_QUERY });
  await i18n.changeLanguage('en');
});

describe('Results', () => {
  it('lists the available campings for the stay', async () => {
    await setup(PARAMS, {
      isPending: false,
      isError: false,
      data: {
        results: [
          result('thalassa', 7000),
          result('pefka', 9050, { coverPhoto: null, region: null }),
        ],
      },
    });
    expect(useSearch).toHaveBeenCalledWith({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: 2,
      childAges: [7],
      equipment: 'tent',
    });
    expect(screen.getByText('10/07/2027 → 12/07/2027 · nights: 2')).toBeTruthy();
    expect(screen.getByText(/Adults: 2 · Children: 1 · Tent/)).toBeTruthy();
    expect(screen.getByText('THALASSA')).toBeTruthy();
    expect(screen.getAllByText('By the sea')).toHaveLength(2);
    expect(screen.getByText(/from €70\.00 total|from 70,00 € total/)).toBeTruthy();
    expect(screen.getByText(/from €90\.50 total|from 90,50 € total/)).toBeTruthy();
  });

  it('shows a camping rating from 3 reviews', async () => {
    await setup(PARAMS, {
      isPending: false,
      isError: false,
      data: {
        results: [
          result('thalassa', 7000, { rating: { average: 4.6, count: 12 } }),
          result('pefka', 9050, { rating: { average: 5, count: 2 } }),
        ],
      },
    });
    expect(screen.getByText('4.6 · reviews: 12')).toBeTruthy();
    expect(screen.queryByText(/reviews: 2/)).toBeNull();
  });

  it('fills in the search form from the link', async () => {
    await setup(PARAMS, { isPending: true });
    expect(useSearchStore.getState().query).toMatchObject({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      childAges: [7],
    });
    await fireEvent.press(screen.getByTestId('search-change'));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('says when nothing is available', async () => {
    await setup(PARAMS, { isPending: false, isError: false, data: { results: [] } });
    expect(screen.getByText('No availability for these dates — try other dates.')).toBeTruthy();
  });

  it('offers a retry after an error', async () => {
    const { refetch } = await setup(PARAMS, { isPending: false, isError: true });
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('explains a broken link', async () => {
    await setup({ arrival: '2027-07-10' }, { isPending: true });
    expect(screen.getByText('This search link is incomplete. Start a new search.')).toBeTruthy();
    expect(useSearch).not.toHaveBeenCalled();
  });

  it("opens a camping's page for the same stay", async () => {
    await setup(
      { ...PARAMS, region: 'Χαλκιδική' },
      { isPending: false, isError: false, data: { results: [result('thalassa', 7000)] } },
    );
    await fireEvent.press(screen.getByTestId('result-thalassa'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/c/[slug]',
      params: { slug: 'thalassa', ...PARAMS },
    });
  });

  it('shows the results on a map', async () => {
    await setup(PARAMS, {
      isPending: false,
      isError: false,
      data: {
        results: [
          result('thalassa', 7000, { lat: 40.2, lng: 23.6 }),
          result('pefka', 9050, { lat: 39.4, lng: 23.1 }),
          result('nowhere', 9900),
        ],
      },
    });
    await fireEvent.press(screen.getByTestId('results-map'));
    expect(screen.queryByTestId('result-thalassa')).toBeNull();
    expect(screen.getByTestId('pins-map')).toBeTruthy();
    expect(screen.getByText('Without a map location: 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pin-pefka'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/c/[slug]',
      params: { slug: 'pefka', ...PARAMS },
    });
    await fireEvent.press(screen.getByTestId('results-list'));
    expect(screen.getByTestId('result-thalassa')).toBeTruthy();
  });
});
