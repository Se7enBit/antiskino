import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Database } from '@/api/database.types';
import { usePitchTypes } from '@/api/pitchTypes';
import {
  useDeleteRate,
  useRates,
  useSaveExtra,
  useSaveFee,
  useSaveGuestCategory,
  useSaveSeason,
  useSeasonPrices,
  useSetSeasonPrices,
} from '@/api/rates';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { RatesScreen } from '../RatesScreen';

jest.mock('@/api/pitchTypes', () => ({ usePitchTypes: jest.fn() }));
jest.mock('@/api/rates', () => ({
  useRates: jest.fn(),
  useSaveSeason: jest.fn(),
  useSaveGuestCategory: jest.fn(),
  useSaveExtra: jest.fn(),
  useSaveFee: jest.fn(),
  useDeleteRate: jest.fn(),
  useSeasonPrices: jest.fn(),
  useSetSeasonPrices: jest.fn(),
}));
let mockCanEdit = true;
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: { camping: { id: string }; canEdit: boolean }) => ReactNode;
  }) => children({ camping: { id: 'c1' }, canEdit: mockCanEdit }),
}));

type Tables = Database['public']['Tables'];
const SEASON: Tables['seasons']['Row'] = {
  id: 's1',
  camping_id: 'c1',
  name: { el: 'Υψηλή', en: 'High' },
  dates: '[2027-07-01,2027-09-01)',
  min_nights: 3,
};
const ADULT: Tables['guest_categories']['Row'] = {
  id: 'g1',
  camping_id: 'c1',
  name: { en: 'Adult' },
  min_age: 12,
  max_age: null,
  sort: 0,
};
const CHILD: Tables['guest_categories']['Row'] = {
  ...ADULT,
  id: 'g2',
  name: { en: 'Child' },
  min_age: 4,
  max_age: 11,
};
const CAR: Tables['extras']['Row'] = {
  id: 'e1',
  camping_id: 'c1',
  name: { en: 'Car' },
  unit: 'per_night',
  max_qty: 2,
  active: false,
  sort: 0,
};
const TAX: Tables['fees']['Row'] = {
  id: 'f1',
  camping_id: 'c1',
  name: { en: 'Tourist tax' },
  unit: 'per_pitch_night',
  amount_cents: 50,
};

type Mutation = ReturnType<typeof fakeMutation>;
type Options = {
  canEdit?: boolean;
  empty?: boolean;
  saveError?: unknown;
};

async function setup({ canEdit = true, empty = false, saveError }: Options = {}) {
  mockCanEdit = canEdit;
  const data = empty
    ? { seasons: [], guestCategories: [], extras: [], fees: [] }
    : { seasons: [SEASON], guestCategories: [ADULT, CHILD], extras: [CAR], fees: [TAX] };
  jest
    .mocked(useRates)
    .mockReturnValue({ isPending: false, data } as unknown as ReturnType<typeof useRates>);
  jest.mocked(usePitchTypes).mockReturnValue({
    isPending: false,
    data: [{ id: 'pt1', name: { en: 'Tent pitch' } }],
  } as unknown as ReturnType<typeof usePitchTypes>);
  jest.mocked(useSeasonPrices).mockReturnValue({
    isPending: false,
    data: [
      { item_type: 'pitch', item_id: 'pt1', amount_cents: 1500 },
      { item_type: 'guest', item_id: 'g1', amount_cents: 850 },
    ],
  } as unknown as ReturnType<typeof useSeasonPrices>);

  const m = {
    season: fakeMutation({ error: saveError }),
    guest: fakeMutation(),
    extra: fakeMutation(),
    fee: fakeMutation(),
    remove: fakeMutation(),
    prices: fakeMutation(),
  };
  const as = <T,>(mutation: Mutation) => mutation as unknown as T;
  jest.mocked(useSaveSeason).mockReturnValue(as(m.season));
  jest.mocked(useSaveGuestCategory).mockReturnValue(as(m.guest));
  jest.mocked(useSaveExtra).mockReturnValue(as(m.extra));
  jest.mocked(useSaveFee).mockReturnValue(as(m.fee));
  jest.mocked(useDeleteRate).mockReturnValue(as(m.remove));
  jest.mocked(useSetSeasonPrices).mockReturnValue(as(m.prices));
  await renderWithLanguage(<RatesScreen />);
  return m;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Rates', () => {
  it('summarises seasons, guest categories, extras and fees', async () => {
    await setup();
    expect(screen.getByText('High · 01/07/2027 – 31/08/2027 · min. nights: 3')).toBeTruthy();
    expect(screen.getByText('Adult · Ages 12+')).toBeTruthy();
    expect(screen.getByText('Child · Ages 4–11')).toBeTruthy();
    expect(screen.getByText('Car · Per night · up to 2')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(
      screen.getByText(
        /Tourist tax · Per pitch per night · €0[.,]50|Tourist tax · Per pitch per night · 0[.,]50/,
      ),
    ).toBeTruthy();
  });

  it('adds a season with the last night turned into the range end', async () => {
    const m = await setup();
    await fireEvent.press(screen.getByTestId('season-add'));
    await fireEvent.changeText(screen.getByTestId('season-nameEn'), 'Low');
    await fireEvent.changeText(screen.getByTestId('season-firstNight'), '1/5/2027');
    await fireEvent.changeText(screen.getByTestId('season-lastNight'), '30/06/2027');
    await fireEvent.changeText(screen.getByTestId('season-minNights'), '2');
    await fireEvent.press(screen.getByTestId('season-save'));
    expect(m.season.mutate).toHaveBeenCalledWith(
      {
        id: undefined,
        values: { name: { en: 'Low' }, dates: '[2027-05-01,2027-07-01)', min_nights: 2 },
      },
      expect.anything(),
    );
  });

  it('shows field errors instead of saving a bad season', async () => {
    const m = await setup();
    await fireEvent.press(screen.getByTestId('season-add'));
    await fireEvent.changeText(screen.getByTestId('season-firstNight'), '31/02/2027');
    await fireEvent.press(screen.getByTestId('season-save'));
    expect(m.season.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a name in at least one language.')).toBeTruthy();
    expect(screen.getByText('Enter a date like 01/07/2027.')).toBeTruthy();
  });

  it('explains an overlapping season', async () => {
    await setup({ saveError: { code: '23P01', message: 'conflicting key value' } });
    await fireEvent.press(screen.getByTestId('season-edit-s1'));
    expect(screen.getByTestId('season-firstNight').props.value).toBe('01/07/2027');
    expect(screen.getByTestId('season-lastNight').props.value).toBe('31/08/2027');
    await fireEvent.press(screen.getByTestId('season-save'));
    expect(screen.getByText('This season overlaps another one.')).toBeTruthy();
  });

  it('deletes only after a second tap', async () => {
    const m = await setup();
    await fireEvent.press(screen.getByTestId('guest-edit-g2'));
    await fireEvent.press(screen.getByTestId('guest-delete'));
    expect(m.remove.mutate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('guest-delete-yes'));
    expect(m.remove.mutate).toHaveBeenCalledWith('g2', expect.anything());
  });

  it('adds an extra and a fee', async () => {
    const m = await setup();
    await fireEvent.press(screen.getByTestId('extra-add'));
    await fireEvent.changeText(screen.getByTestId('extra-nameEn'), 'Pet');
    await fireEvent.press(screen.getByTestId('extra-unit-per_stay'));
    await fireEvent.press(screen.getByTestId('extra-save'));
    expect(m.extra.mutate).toHaveBeenCalledWith(
      {
        id: undefined,
        values: expect.objectContaining({
          name: { en: 'Pet' },
          unit: 'per_stay',
          max_qty: 1,
          active: true,
        }),
      },
      expect.anything(),
    );

    await fireEvent.press(screen.getByTestId('fee-add'));
    await fireEvent.changeText(screen.getByTestId('fee-nameEl'), 'Φόρος');
    await fireEvent.changeText(screen.getByTestId('fee-amount'), '1,5');
    await fireEvent.press(screen.getByTestId('fee-save'));
    expect(m.fee.mutate).toHaveBeenCalledWith(
      {
        id: undefined,
        values: { name: { el: 'Φόρος' }, unit: 'per_person_night', amount_cents: 150 },
      },
      expect.anything(),
    );
  });

  it('prefills the price grid and saves only the filled amounts', async () => {
    const m = await setup();
    expect(screen.getByTestId('price-pitch:pt1').props.value).toBe('15');
    expect(screen.getByTestId('price-guest:g1').props.value).toBe('8.50');
    expect(screen.getByTestId('price-guest:g2').props.value).toBe('');
    await fireEvent.changeText(screen.getByTestId('price-guest:g2'), '4,5');
    await fireEvent.changeText(screen.getByTestId('price-extra:e1'), '3');
    await fireEvent.press(screen.getByTestId('prices-save'));
    expect(m.prices.mutate).toHaveBeenCalledWith({
      seasonId: 's1',
      prices: [
        { item_type: 'pitch', item_id: 'pt1', amount_cents: 1500 },
        { item_type: 'guest', item_id: 'g1', amount_cents: 850 },
        { item_type: 'guest', item_id: 'g2', amount_cents: 450 },
        { item_type: 'extra', item_id: 'e1', amount_cents: 300 },
      ],
    });
  });

  it('does not save prices with a bad amount', async () => {
    const m = await setup();
    await fireEvent.changeText(screen.getByTestId('price-pitch:pt1'), '15€');
    await fireEvent.press(screen.getByTestId('prices-save'));
    expect(m.prices.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Fix the highlighted amounts, e.g. 12 or 12,50.')).toBeTruthy();
  });

  it('asks for a season before prices', async () => {
    await setup({ empty: true });
    expect(screen.getByText('Add a season first, then set its prices.')).toBeTruthy();
    expect(screen.queryByTestId('prices-save')).toBeNull();
  });

  it('is read-only for staff', async () => {
    await setup({ canEdit: false });
    expect(screen.queryByTestId('season-add')).toBeNull();
    expect(screen.queryByTestId('season-edit-s1')).toBeNull();
    expect(screen.queryByTestId('prices-save')).toBeNull();
    expect(screen.getByTestId('price-pitch:pt1').props.editable).toBe(false);
  });
});
