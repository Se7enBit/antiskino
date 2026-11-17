import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { useGuestBooking, useGuestCancelBooking, type GuestBooking } from '@/api/guestBooking';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { ManageBookingScreen } from '../ManageBookingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/api/guestBooking', () => ({
  useGuestBooking: jest.fn(),
  useGuestCancelBooking: jest.fn(),
}));

const BOOKING: GuestBooking = {
  ref: 'ANT-7K3P9Q',
  status: 'confirmed',
  can_cancel: true,
  arrival: '2027-07-10',
  departure: '2027-07-12',
  nights: 2,
  equipment: 'tent',
  party: { adult: 2 },
  extras: {},
  total_cents: 6200,
  price_breakdown: {
    nights: [],
    lines: [
      { kind: 'pitch', id: 'pt', quantity: 1, per: 'night', totalCents: 3000 },
      { kind: 'guest', id: 'adult', quantity: 2, per: 'night', totalCents: 3200 },
    ],
    totalCents: 6200,
    names: { pitch: { en: 'Tent pitch' }, guest: { adult: { en: 'Adult' } }, extra: {}, fee: {} },
  },
  payment_mode: 'on_site',
  cancellation_policy: 'flexible',
  request_expires_at: null,
  cancel_reason: null,
  created_at: '2027-06-01T10:00:00Z',
  guest: {
    name: 'Maria P.',
    email: 'maria@example.com',
    phone: '+30 690 123 4567',
    country: 'GR',
    locale: 'en',
    vehicle_plate: null,
    arrival_eta: null,
    note: null,
  },
  camping: {
    name: 'Camping Thalassa',
    slug: 'thalassa',
    address: 'Nikiti',
    lat: null,
    lng: null,
    phone: '+30 23750 00000',
    email: null,
    check_in_from: '14:00:00',
    check_out_until: '12:00:00',
  },
  pitch_type: { id: 'pt', name: { en: 'Renamed pitch' } },
  names: { guest: { adult: { en: 'Grown-up' } }, extra: {}, fee: {} },
};

async function setup(params: Record<string, string>, booking: GuestBooking | null = BOOKING) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  jest.mocked(useGuestBooking).mockReturnValue({
    isPending: false,
    isError: false,
    data: booking,
  } as unknown as ReturnType<typeof useGuestBooking>);
  const cancel = fakeMutation();
  jest
    .mocked(useGuestCancelBooking)
    .mockReturnValue(cancel as unknown as ReturnType<typeof useGuestCancelBooking>);
  await renderWithLanguage(<ManageBookingScreen />);
  return { cancel };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Manage link', () => {
  it('shows the booking with the names it was booked with', async () => {
    await setup({ ref: 'ANT-7K3P9Q', t: 'token' });
    expect(useGuestBooking).toHaveBeenCalledWith('ANT-7K3P9Q', 'token');
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Reference ANT-7K3P9Q')).toBeTruthy();
    expect(screen.getByText('Camping Thalassa · Tent pitch')).toBeTruthy();
    expect(screen.getByText('10/07/2027 → 12/07/2027 · nights: 2')).toBeTruthy();
    expect(screen.getByText('Adult: 2 · Tent')).toBeTruthy();
    expect(screen.getByText('Check-in from 14:00')).toBeTruthy();
    expect(screen.getByText(/You pay (€62\.00|62,00 €) at reception/)).toBeTruthy();
  });

  it('cancels after a second tap', async () => {
    const { cancel } = await setup({ ref: 'ANT-7K3P9Q', t: 'token' });
    expect(screen.getByText('To change dates, cancel and book again.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('booking-cancel'));
    expect(cancel.mutate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('booking-cancel-yes'));
    expect(cancel.mutate).toHaveBeenCalled();
  });

  it('explains requests and cancellations', async () => {
    await setup(
      { ref: 'ANT-7K3P9Q', t: 'token' },
      { ...BOOKING, status: 'requested', request_expires_at: '2027-06-02T11:00:00Z' },
    );
    expect(screen.getByText('Request sent')).toBeTruthy();
    expect(screen.getByText(/The camping answers by 2 Jun 2027, 14:00/)).toBeTruthy();
  });

  it('shows a cancelled booking without a cancel button', async () => {
    await setup(
      { ref: 'ANT-7K3P9Q', t: 'token' },
      { ...BOOKING, status: 'cancelled', can_cancel: false, cancel_reason: 'Flooded pitch' },
    );
    expect(screen.getByText('This booking is cancelled. Reason: Flooded pitch')).toBeTruthy();
    expect(screen.queryByTestId('booking-cancel')).toBeNull();
  });

  it('says when the link is wrong or incomplete', async () => {
    await setup({ ref: 'ANT-7K3P9Q', t: 'wrong' }, null);
    expect(
      screen.getByText("We couldn't find this booking. Check that you opened the whole link."),
    ).toBeTruthy();
    jest.clearAllMocks();
    await setup({ ref: 'ANT-7K3P9Q' });
    expect(useGuestBooking).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("We couldn't find this booking. Check that you opened the whole link.")
        .length,
    ).toBeGreaterThan(0);
  });
});
