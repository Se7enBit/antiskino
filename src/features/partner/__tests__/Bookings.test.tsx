import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import {
  useCampingBookings,
  usePartnerBookingAction,
  type CampingBooking,
} from '@/api/partnerBookings';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { BookingsScreen } from '../BookingsScreen';

jest.mock('@/api/partnerBookings', () => ({
  useCampingBookings: jest.fn(),
  usePartnerBookingAction: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-05',
}));
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: { camping: { id: string }; canEdit: boolean }) => ReactNode;
  }) => children({ camping: { id: 'c1' }, canEdit: false }),
}));

const booking = (ref: string, patch: Partial<CampingBooking> = {}): CampingBooking => ({
  id: ref,
  ref,
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  nights: 2,
  equipment: 'caravan',
  party_size: 3,
  total_cents: 9050,
  guest_name: `Guest ${ref}`,
  guest_email: 'guest@example.com',
  guest_phone: '+30 690 123 4567',
  guest_country: 'GR',
  guest_note: null,
  arrival_eta: null,
  vehicle_plate: null,
  request_expires_at: null,
  cancel_reason: null,
  created_at: '2027-06-01T10:00:00Z',
  pitch_type: { name: { en: 'Caravan pitch' } },
  ...patch,
});

async function setup(list: CampingBooking[]) {
  jest
    .mocked(useCampingBookings)
    .mockReturnValue({ isPending: false, isError: false, data: list } as unknown as ReturnType<
      typeof useCampingBookings
    >);
  const action = fakeMutation();
  jest
    .mocked(usePartnerBookingAction)
    .mockReturnValue(action as unknown as ReturnType<typeof usePartnerBookingAction>);
  await renderWithLanguage(<BookingsScreen />);
  return { action };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Partner bookings', () => {
  const LIST = [
    booking('ANT-PAST01', { arrival: '2027-06-20', departure: '2027-06-22', status: 'completed' }),
    booking('ANT-STAY01', {
      arrival_eta: '16:30:00',
      vehicle_plate: 'IKA 1234',
      guest_note: 'Late arrival',
    }),
    booking('ANT-REQ001', { status: 'requested', request_expires_at: '2027-07-06T09:00:00Z' }),
    booking('ANT-CANC01', { status: 'cancelled', cancel_reason: 'Flooded pitch' }),
  ];

  it('shows requests first, then upcoming stays; past ones on demand', async () => {
    await setup(LIST);
    expect(useCampingBookings).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Requests to answer')).toBeTruthy();
    expect(screen.getByText('Answer by 6 Jul 2027, 12:00')).toBeTruthy();
    expect(screen.getByText('Upcoming stays')).toBeTruthy();
    expect(screen.getByText('Arrives around 16:30')).toBeTruthy();
    expect(screen.getByText('Plate: IKA 1234')).toBeTruthy();
    expect(screen.getByText('Note: Late arrival')).toBeTruthy();
    expect(screen.queryByTestId('partner-booking-ANT-PAST01')).toBeNull();
    await fireEvent.press(screen.getByTestId('toggle-past'));
    expect(screen.getByTestId('partner-booking-ANT-PAST01')).toBeTruthy();
    expect(screen.getByText('Reason: Flooded pitch')).toBeTruthy();
  });

  it('accepts and declines requests (decline after a second tap)', async () => {
    const { action } = await setup(LIST);
    await fireEvent.press(screen.getByTestId('accept-ANT-REQ001'));
    expect(action.mutate).toHaveBeenLastCalledWith({
      bookingId: 'ANT-REQ001',
      action: 'accept',
      reason: undefined,
    });
    await fireEvent.press(screen.getByTestId('decline-ANT-REQ001'));
    expect(action.mutate).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('decline-ANT-REQ001-yes'));
    expect(action.mutate).toHaveBeenLastCalledWith({
      bookingId: 'ANT-REQ001',
      action: 'decline',
      reason: undefined,
    });
  });

  it('cancels only with a reason', async () => {
    const { action } = await setup(LIST);
    await fireEvent.press(screen.getByTestId('cancel-ANT-STAY01'));
    await fireEvent.press(screen.getByTestId('cancel-confirm-ANT-STAY01'));
    expect(screen.getByText('Write a short reason for the guest.')).toBeTruthy();
    expect(action.mutate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('cancel-reason-ANT-STAY01'), ' Flooded pitch ');
    await fireEvent.press(screen.getByTestId('cancel-confirm-ANT-STAY01'));
    expect(action.mutate).toHaveBeenCalledWith({
      bookingId: 'ANT-STAY01',
      action: 'cancel',
      reason: 'Flooded pitch',
    });
  });

  it('offers no actions on finished bookings', async () => {
    await setup(LIST);
    await fireEvent.press(screen.getByTestId('toggle-past'));
    expect(screen.queryByTestId('cancel-ANT-PAST01')).toBeNull();
    expect(screen.queryByTestId('cancel-ANT-CANC01')).toBeNull();
  });

  it('calls the guest', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup([booking('ANT-STAY01')]);
    await fireEvent.press(screen.getByText('Call +30 690 123 4567'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+306901234567');
  });

  it('says when there are no bookings', async () => {
    await setup([]);
    expect(screen.getByText('No bookings yet.')).toBeTruthy();
  });
});
