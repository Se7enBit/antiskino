import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { useCampingPage, type CampingPage as Camping } from '@/api/camping';
import { useSearch } from '@/api/search';
import { DEFAULT_QUERY } from '@/domain/search';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { useSearchStore } from '../../search/searchStore';
import { CampingPage } from '../CampingPage';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/api/camping', () => ({ useCampingPage: jest.fn() }));
jest.mock('@/api/search', () => ({ useSearch: jest.fn() }));
jest.mock('@/api/photos', () => ({ photoUrl: (path: string) => `https://cdn.test/${path}` }));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-06-15',
}));

const pitchType = (id: string, patch: Partial<Camping['pitchTypes'][number]> = {}) => ({
  id,
  name: { en: id === 'tent' ? 'Tent pitch' : 'Caravan pitch' },
  descr: {},
  included: { en: 'Showers' },
  accepts: ['tent' as const],
  max_people: 4,
  size_m2: 60,
  photos: [],
  active: true,
  sort: 0,
  ...patch,
});

const CAMPING: Camping = {
  id: 'c1',
  slug: 'thalassa',
  status: 'live',
  name: 'Camping Thalassa',
  short_descr: { en: 'By the sea' },
  descr: { en: 'A family camping under the pines.' },
  house_rules: { en: 'Quiet hours 23:00–07:00.' },
  region: 'Halkidiki',
  address: 'Nikiti, Halkidiki',
  lat: 40.2,
  lng: 23.6,
  amenities: ['wifi', 'pool', 'not_an_amenity'],
  check_in_from: '14:00:00',
  check_out_until: '12:00:00',
  confirmation_mode: 'instant',
  request_expiry_hours: 24,
  payment_mode: 'on_site',
  cancellation_policy: 'flexible',
  camping_photos: [],
  pitch_types: [],
  seasons: [{ id: 'high', dates: '[2027-07-01,2027-09-01)' }],
  photos: ['c1/a.jpg', 'c1/b.jpg'],
  pitchTypes: [pitchType('tent'), pitchType('van', { accepts: ['caravan'] })],
  pitchPrices: [{ season_id: 'high', item_id: 'tent', amount_cents: 1250 }],
};

const REQUEST = {
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: 2,
  childAges: [],
  equipment: 'tent' as const,
};

type Options = {
  camping?: Camping | null;
  request?: typeof REQUEST | null;
  page?: Partial<ReturnType<typeof useCampingPage>>;
};

async function setup({ camping = CAMPING, request = null, page }: Options = {}) {
  jest.mocked(useCampingPage).mockReturnValue({
    isPending: false,
    isError: false,
    data: camping,
    refetch: jest.fn(),
    ...page,
  } as unknown as ReturnType<typeof useCampingPage>);
  jest.mocked(useSearch).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      results: [
        { camping: {}, fromTotalCents: 7000, pitchTypes: [{ id: 'tent', totalCents: 7000 }] },
      ],
    },
  } as unknown as ReturnType<typeof useSearch>);
  const onSearch = jest.fn();
  const onNotFound = jest.fn();
  await renderWithLanguage(
    <CampingPage slug="thalassa" request={request} onSearch={onSearch} onNotFound={onNotFound} />,
  );
  return { onSearch, onNotFound };
}

beforeEach(async () => {
  jest.clearAllMocks();
  useSearchStore.setState({ query: DEFAULT_QUERY });
  await i18n.changeLanguage('en');
});

describe('CampingPage', () => {
  it('shows from-prices and the search form without dates', async () => {
    await setup();
    expect(screen.getByText('Camping Thalassa')).toBeTruthy();
    expect(screen.getByText('Check availability')).toBeTruthy();
    expect(screen.getByTestId('search-submit')).toBeTruthy();
    expect(screen.getByTestId('pitch-tent-price').props.children).toMatch(
      /Pitch from (€12\.50|12,50 €) \/ night/,
    );
    // no price in a current season: nothing to show
    expect(screen.getByTestId('pitch-van-price').props.children).toBe('');
    expect(useSearch).toHaveBeenCalledWith(null);
  });

  it('prices the stay and greys out unavailable pitch types', async () => {
    await setup({ request: REQUEST });
    expect(useSearch).toHaveBeenCalledWith({ ...REQUEST, campingId: 'c1' });
    expect(screen.getByText('Your stay')).toBeTruthy();
    expect(screen.getByTestId('pitch-tent-price').props.children).toMatch(
      /(€70\.00|70,00 €) total/,
    );
    expect(screen.getByTestId('pitch-van-price').props.children).toBe(
      'Not available for these dates',
    );
    // the search form follows the stay shown
    expect(useSearchStore.getState().query).toMatchObject({
      arrival: '2027-07-10',
      departure: '2027-07-12',
    });
  });

  it('changes the stay', async () => {
    const { onSearch } = await setup({ request: REQUEST });
    await fireEvent.press(screen.getByTestId('search-change'));
    await fireEvent.press(screen.getByTestId('search-adults-plus'));
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(onSearch).toHaveBeenCalledWith({ ...REQUEST, adults: 3 });
  });

  it('describes the camping in plain words', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup();
    expect(screen.getByText('Wi-Fi')).toBeTruthy();
    expect(screen.getByText('Pool')).toBeTruthy();
    expect(screen.getByText('Check-in from 14:00')).toBeTruthy();
    expect(screen.getByText('Check-out until 12:00')).toBeTruthy();
    expect(screen.getByText('Instant confirmation.')).toBeTruthy();
    expect(screen.getByText('You pay at reception. Nothing is charged online.')).toBeTruthy();
    expect(
      screen.getByText('Flexible cancellation: full refund up to the day before arrival.'),
    ).toBeTruthy();
    expect(screen.getByText('Quiet hours 23:00–07:00.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('camping-directions'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('40.2,23.6'));
  });

  it('explains request mode and flags drafts', async () => {
    await setup({
      camping: {
        ...CAMPING,
        status: 'draft',
        confirmation_mode: 'request',
        request_expiry_hours: 12,
      },
    });
    expect(screen.getByText("Not published yet: guests can't see this page.")).toBeTruthy();
    expect(
      screen.getByText('You send a request; the camping answers within 12 hours.'),
    ).toBeTruthy();
  });

  it('handles a missing camping and errors', async () => {
    const { onNotFound } = await setup({ camping: null });
    expect(screen.getByText("This camping isn't on Antiskino right now.")).toBeTruthy();
    await fireEvent.press(screen.getByText('New search'));
    expect(onNotFound).toHaveBeenCalled();
  });

  it('offers a retry when loading fails', async () => {
    const refetch = jest.fn();
    await setup({ page: { isError: true, data: undefined, refetch } as never });
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });
});
