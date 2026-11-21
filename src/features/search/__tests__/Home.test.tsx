import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useLiveCampings } from '@/api/search';
import { DEFAULT_QUERY } from '@/domain/search';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { HomeScreen } from '../HomeScreen';
import { useSearchStore } from '../searchStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/api/search', () => ({ useLiveCampings: jest.fn() }));
jest.mock('../../camping/CampingPage', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CampingPage: ({
      slug,
      onSearch,
    }: {
      slug: string;
      onSearch: (request: Record<string, unknown>) => void;
    }) => (
      <Text
        onPress={() =>
          onSearch({
            arrival: '2027-07-10',
            departure: '2027-07-12',
            adults: 2,
            childAges: [],
            equipment: 'tent',
            region: 'Χαλκιδική',
          })
        }
      >{`camping page: ${slug}`}</Text>
    ),
  };
});
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-05',
}));

async function setup(regions: (string | null)[] = ['Χαλκιδική', 'Χαλκιδική'], isLoading = false) {
  jest.mocked(useLiveCampings).mockReturnValue({
    isLoading,
    data: isLoading
      ? undefined
      : regions.map((region, i) => ({ id: `c${i}`, slug: `c${i}`, name: `C${i}`, region })),
  } as unknown as ReturnType<typeof useLiveCampings>);
  await renderWithLanguage(<HomeScreen />);
}

beforeEach(async () => {
  jest.clearAllMocks();
  useSearchStore.setState({ query: DEFAULT_QUERY });
  await i18n.changeLanguage('en');
});

describe('Home search', () => {
  it('asks for dates before searching', async () => {
    await setup();
    expect(screen.getByText('Add dates')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(screen.getByText('Pick your arrival and departure days.')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('searches for the dates, party and equipment picked', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('search-dates'));
    await fireEvent.press(screen.getByTestId('day-2027-07-10'));
    await fireEvent.press(screen.getByTestId('day-2027-07-12'));
    // the calendar closes once both days are picked
    expect(screen.queryByTestId('day-2027-07-10')).toBeNull();
    expect(screen.getByText('10/07/2027 → 12/07/2027 · nights: 2')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-adults-plus'));
    await fireEvent.press(screen.getByTestId('search-children-plus'));
    await fireEvent.press(screen.getByTestId('search-children-plus'));
    expect(screen.getByTestId('search-child-1-value').props.children).toBe(6);
    await fireEvent.press(screen.getByTestId('search-child-0-minus'));
    await fireEvent.press(screen.getByTestId('search-equipment-camper'));
    await fireEvent.press(screen.getByTestId('search-submit'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/search',
      params: {
        arrival: '2027-07-10',
        departure: '2027-07-12',
        adults: '3',
        children: '5,6',
        equipment: 'camper',
      },
    });
  });

  it('removes the last child when there are fewer children', async () => {
    useSearchStore.setState({ query: { ...DEFAULT_QUERY, childAges: [3, 9] } });
    await setup();
    await fireEvent.press(screen.getByTestId('search-children-minus'));
    expect(useSearchStore.getState().query.childAges).toEqual([3]);
  });

  it('refuses an arrival day that has passed', async () => {
    useSearchStore.setState({
      query: { ...DEFAULT_QUERY, arrival: '2027-07-01', departure: '2027-07-03' },
    });
    await setup();
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(screen.getByText('The arrival day has passed. Pick new dates.')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('offers a region filter only when campings span two regions or more', async () => {
    await setup(['Χαλκιδική', null, 'Χαλκιδική']);
    expect(screen.queryByText('All regions')).toBeNull();
  });

  it('filters by region', async () => {
    useSearchStore.setState({
      query: { ...DEFAULT_QUERY, arrival: '2027-07-10', departure: '2027-07-12' },
    });
    await setup(['Χαλκιδική', 'Πήλιο']);
    expect(screen.getByText('All regions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-region-Πήλιο'));
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/search',
      params: expect.objectContaining({ region: 'Πήλιο' }),
    });
  });

  it('waits for the live campings', async () => {
    await setup([], true);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByTestId('search-submit')).toBeNull();
  });

  it("shows the camping's page when exactly one camping is live", async () => {
    await setup(['Χαλκιδική']);
    expect(screen.getByText('camping page: c0')).toBeTruthy();
    expect(screen.queryByTestId('search-submit')).toBeNull();
    await fireEvent.press(screen.getByText('camping page: c0'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/en/c/[slug]',
      params: {
        slug: 'c0',
        arrival: '2027-07-10',
        departure: '2027-07-12',
        adults: '2',
        equipment: 'tent',
      },
    });
  });
});
