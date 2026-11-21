import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { useUpdateBookingGuest } from '@/api/admin';
import {
  usePartnerBooking,
  usePartnerBookingAction,
  useUpdateBookingDesk,
  type PartnerBooking,
} from '@/api/partnerBookings';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { AdminBookingScreen } from '../AdminBookingScreen';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('@/api/admin', () => ({ useUpdateBookingGuest: jest.fn() }));
jest.mock('@/api/partnerBookings', () => ({
  usePartnerBooking: jest.fn(),
  usePartnerBookingAction: jest.fn(),
  useUpdateBookingDesk: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-01',
}));

const BOOKING: PartnerBooking = {
  id: 'b1',
  ref: 'ANT-7KQ2XM',
  camping_id: 'c1',
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  nights: 2,
  equipment: 'tent',
  party: {},
  party_size: 2,
  extras: {},
  total_cents: 9050,
  price_breakdown: null,
  payment_mode: 'on_site',
  cancellation_policy: 'flexible',
  commission_cents: 543,
  guest_name: 'Maria Papadopoulou',
  guest_email: 'maria@exmaple.com',
  guest_phone: '+30 690 123 4567',
  guest_country: 'GR',
  locale: 'el',
  guest_note: null,
  arrival_eta: null,
  vehicle_plate: null,
  request_expires_at: null,
  cancel_reason: null,
  assigned_pitch: null,
  internal_note: null,
  created_at: '2027-06-01T10:00:00Z',
  pitch_type: { name: { en: 'Tent pitch' } },
  events: [
    {
      id: 1,
      at: '2027-06-01T10:00:00Z',
      actor_kind: 'guest',
      from_status: null,
      to_status: 'confirmed',
      note: null,
    },
    {
      id: 2,
      at: '2027-06-02T09:00:00Z',
      actor_kind: 'admin',
      from_status: 'confirmed',
      to_status: 'confirmed',
      note: null,
    },
  ],
};

const update = fakeMutation();
const action = fakeMutation();

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
  jest.mocked(useLocalSearchParams).mockReturnValue({ ref: 'ANT-7KQ2XM' });
  jest.mocked(usePartnerBooking).mockReturnValue({
    isPending: false,
    isError: false,
    data: BOOKING,
  } as unknown as ReturnType<typeof usePartnerBooking>);
  jest
    .mocked(usePartnerBookingAction)
    .mockReturnValue(action as unknown as ReturnType<typeof usePartnerBookingAction>);
  jest
    .mocked(useUpdateBookingDesk)
    .mockReturnValue(fakeMutation() as unknown as ReturnType<typeof useUpdateBookingDesk>);
  jest
    .mocked(useUpdateBookingGuest)
    .mockReturnValue(update as unknown as ReturnType<typeof useUpdateBookingGuest>);
});

describe('Admin booking page', () => {
  it('shows the booking as the camping sees it, with its history', async () => {
    await renderWithLanguage(<AdminBookingScreen />);
    expect(usePartnerBooking).toHaveBeenCalledWith('ANT-7KQ2XM');
    expect(
      screen.getByText("You act as Antiskino: every change shows in the booking's history."),
    ).toBeTruthy();
    expect(screen.getByText('Guest details corrected · by Antiskino')).toBeTruthy();
  });

  it('cancels with a reason', async () => {
    await renderWithLanguage(<AdminBookingScreen />);
    await fireEvent.press(screen.getByTestId('cancel-ANT-7KQ2XM'));
    await fireEvent.changeText(screen.getByTestId('cancel-reason-ANT-7KQ2XM'), 'Camping closed');
    await fireEvent.press(screen.getByTestId('cancel-confirm-ANT-7KQ2XM'));
    expect(action.mutate).toHaveBeenCalledWith({
      bookingId: 'b1',
      action: 'cancel',
      reason: 'Camping closed',
    });
  });

  it('corrects the guest’s details, checked like the booking form', async () => {
    await renderWithLanguage(<AdminBookingScreen />);
    await fireEvent.press(screen.getByTestId('admin-edit-guest'));
    await fireEvent.changeText(screen.getByTestId('admin-guest-phone'), '690 123');
    await fireEvent.press(screen.getByTestId('admin-guest-save'));
    expect(
      screen.getByText('Enter the number with the country code, e.g. +30 690 123 4567.'),
    ).toBeTruthy();
    expect(update.mutate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('admin-guest-phone'), '+30 690 123 4567');
    await fireEvent.changeText(screen.getByTestId('admin-guest-email'), ' maria@example.com ');
    await fireEvent.changeText(screen.getByTestId('admin-guest-country'), 'cy');
    await fireEvent.press(screen.getByText('English'));
    await fireEvent.press(screen.getByTestId('admin-guest-save'));
    expect(update.mutate).toHaveBeenCalledWith(
      {
        bookingId: 'b1',
        guest: {
          name: 'Maria Papadopoulou',
          email: 'maria@example.com',
          phone: '+30 690 123 4567',
          country: 'CY',
          locale: 'en',
        },
      },
      expect.anything(),
    );
  });
});
