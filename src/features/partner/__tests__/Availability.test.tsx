import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useInventory, useSetAllotment, useSetClosed } from '@/api/inventory';
import { usePitchTypes } from '@/api/pitchTypes';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { AvailabilityScreen } from '../AvailabilityScreen';

jest.mock('@/api/pitchTypes', () => ({ usePitchTypes: jest.fn() }));
jest.mock('@/api/inventory', () => ({
  useInventory: jest.fn(),
  useSetAllotment: jest.fn(),
  useSetClosed: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-01',
}));
let mockCanEdit = true;
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: { camping: { id: string }; canEdit: boolean }) => ReactNode;
  }) => children({ camping: { id: 'c1' }, canEdit: mockCanEdit }),
}));

const PITCH_TYPES = [
  { id: 'pt1', name: { en: 'Tent pitch' } },
  { id: 'pt2', name: { en: 'Caravan pitch' } },
];
const INVENTORY = [
  { pitch_type_id: 'pt1', night: '2027-07-01', allotment: 5, booked: 2, closed: false },
  { pitch_type_id: 'pt1', night: '2027-07-02', allotment: 5, booked: 5, closed: false },
  { pitch_type_id: 'pt1', night: '2027-07-03', allotment: 6, booked: 1, closed: true },
];

type Options = { canEdit?: boolean; pitchTypes?: typeof PITCH_TYPES; allotmentError?: unknown };

async function setup({ canEdit = true, pitchTypes = PITCH_TYPES, allotmentError }: Options = {}) {
  mockCanEdit = canEdit;
  jest
    .mocked(usePitchTypes)
    .mockReturnValue({ isPending: false, data: pitchTypes } as unknown as ReturnType<
      typeof usePitchTypes
    >);
  jest
    .mocked(useInventory)
    .mockReturnValue({ isPending: false, data: INVENTORY } as unknown as ReturnType<
      typeof useInventory
    >);
  const allotment = fakeMutation({ error: allotmentError });
  const closing = fakeMutation();
  jest
    .mocked(useSetAllotment)
    .mockReturnValue(allotment as unknown as ReturnType<typeof useSetAllotment>);
  jest.mocked(useSetClosed).mockReturnValue(closing as unknown as ReturnType<typeof useSetClosed>);
  await renderWithLanguage(<AvailabilityScreen />);
  return { allotment, closing };
}

const lastInventoryCall = () => jest.mocked(useInventory).mock.lastCall;

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Availability', () => {
  it('shows booked / allotment per pitch type and night from today', async () => {
    await setup();
    expect(lastInventoryCall()).toEqual([['pt1', 'pt2'], '2027-07-01', '2027-07-14']);
    expect(screen.getByLabelText('Tent pitch, Thu 01/07: 2 of 5 booked')).toBeTruthy();
    expect(screen.getByLabelText('Tent pitch, Fri 02/07: 5 of 5 booked')).toBeTruthy();
    expect(screen.getByLabelText('Tent pitch, Sat 03/07: 1 of 6 booked, closed')).toBeTruthy();
    expect(screen.getByLabelText('Caravan pitch, Thu 01/07: no allotment')).toBeTruthy();
    expect(screen.getByText('2/5')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(14);
  });

  it('moves two weeks at a time', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('nights-later'));
    expect(lastInventoryCall()?.slice(1)).toEqual(['2027-07-15', '2027-07-28']);
    await fireEvent.press(screen.getByTestId('nights-earlier'));
    await fireEvent.press(screen.getByTestId('nights-earlier'));
    expect(lastInventoryCall()?.slice(1)).toEqual(['2027-06-17', '2027-06-30']);
    await fireEvent.press(screen.getByTestId('nights-today'));
    expect(lastInventoryCall()?.slice(1)).toEqual(['2027-07-01', '2027-07-14']);
  });

  it('fills in the forms from a tapped night and sets the allotment', async () => {
    const { allotment } = await setup();
    await fireEvent.press(screen.getByTestId('cell-pt1-2027-07-03'));
    expect(screen.getByTestId('allotment-firstNight').props.value).toBe('03/07/2027');
    expect(screen.getByTestId('allotment-value').props.value).toBe('6');
    expect(screen.getByTestId('closing-lastNight').props.value).toBe('03/07/2027');

    await fireEvent.changeText(screen.getByTestId('allotment-lastNight'), '10/07/2027');
    await fireEvent.changeText(screen.getByTestId('allotment-value'), '8');
    await fireEvent.press(screen.getByTestId('allotment-save'));
    expect(allotment.mutate).toHaveBeenCalledWith({
      p_pitch_type_id: 'pt1',
      p_first_night: '2027-07-03',
      p_last_night: '2027-07-10',
      p_allotment: 8,
    });
  });

  it('checks the allotment form before saving', async () => {
    const { allotment } = await setup();
    await fireEvent.changeText(screen.getByTestId('allotment-firstNight'), '01/01/2027');
    await fireEvent.changeText(screen.getByTestId('allotment-lastNight'), '01/01/2029');
    await fireEvent.changeText(screen.getByTestId('allotment-value'), 'lots');
    await fireEvent.press(screen.getByTestId('allotment-save'));
    expect(allotment.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number from 0 to 1000.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('allotment-value'), '4');
    await fireEvent.press(screen.getByTestId('allotment-save'));
    expect(allotment.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Pick at most 400 nights at a time.')).toBeTruthy();
  });

  it('explains an allotment below the bookings', async () => {
    await setup({ allotmentError: { code: '23514', message: 'cannot go below' } });
    expect(
      screen.getByText(
        'Some of these nights already have more bookings than that. Nothing was changed.',
      ),
    ).toBeTruthy();
  });

  it('closes and opens nights for the chosen pitch types', async () => {
    const { closing } = await setup();
    await fireEvent.changeText(screen.getByTestId('closing-firstNight'), '15/08/2027');
    await fireEvent.changeText(screen.getByTestId('closing-lastNight'), '16/08/2027');
    await fireEvent.press(screen.getByTestId('closing-close'));
    expect(closing.mutate).toHaveBeenLastCalledWith({
      values: { pitchTypeIds: ['pt1', 'pt2'], firstNight: '2027-08-15', lastNight: '2027-08-16' },
      closed: true,
    });

    await fireEvent.press(screen.getByTestId('closing-pitch-pt1'));
    await fireEvent.press(screen.getByTestId('closing-open'));
    expect(closing.mutate).toHaveBeenLastCalledWith({
      values: { pitchTypeIds: ['pt2'], firstNight: '2027-08-15', lastNight: '2027-08-16' },
      closed: false,
    });

    await fireEvent.press(screen.getByTestId('closing-pitch-pt2'));
    await fireEvent.press(screen.getByTestId('closing-close'));
    expect(closing.mutate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Pick a pitch type.')).toBeTruthy();
  });

  it('lets staff close nights but not change the allotment', async () => {
    await setup({ canEdit: false });
    expect(screen.queryByTestId('allotment-save')).toBeNull();
    expect(screen.getByText('Only owners can change the allotment.')).toBeTruthy();
    expect(screen.getByTestId('closing-close')).toBeTruthy();
  });

  it('asks for a pitch type first', async () => {
    await setup({ pitchTypes: [] });
    expect(screen.getByText('Add a pitch type first, then set its allotment.')).toBeTruthy();
  });
});
