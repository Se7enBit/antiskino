import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/api/auth';
import type { GuestBooking } from '@/api/guestBooking';
import {
  useCancelMyBooking,
  useMyBooking,
  useMyBookings,
  type MyBookingItem,
} from '@/api/myBookings';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { MyBookingScreen } from '../MyBookingScreen';
import { MyBookingsScreen } from '../MyBookingsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/myBookings', () => ({
  useMyBookings: jest.fn(),
  useMyBooking: jest.fn(),
  useCancelMyBooking: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-05',
}));

const item = (ref: string, patch: Partial<MyBookingItem> = {}): MyBookingItem => ({
  id: ref,
  ref,
  status: 'confirmed',
  arrival: '2027-07-10',
  departure: '2027-07-12',
  totalCents: 6200,
  campingName: 'Camping Thalassa',
  pitchName: { en: 'Tent pitch' },
  ...patch,
});

function signedIn(signed = true) {
  jest.mocked(useAuth).mockReturnValue({
    status: signed ? 'signedIn' : 'signedOut',
    session: signed ? ({ user: { id: 'u1', email: 'maria@example.com' } } as never) : null,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('My bookings', () => {
  it('asks guests to sign in and points to their booking link', async () => {
    signedIn(false);
    await renderWithLanguage(<MyBookingsScreen />);
    expect(screen.getByText('Sign in to see your bookings here.')).toBeTruthy();
    expect(
      screen.getByText('Booked without an account? Open the link you got when you booked.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Sign in'));
    expect(router.navigate).toHaveBeenCalledWith('/account');
  });

  it('lists upcoming bookings first, then past and cancelled ones', async () => {
    signedIn();
    jest.mocked(useMyBookings).mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        item('ANT-PAST01', { arrival: '2027-06-01', departure: '2027-06-03', status: 'completed' }),
        item('ANT-NEXT01'),
        item('ANT-CANC01', { status: 'cancelled', campingName: null, pitchName: null }),
        item('ANT-REQU01', { arrival: '2027-08-01', departure: '2027-08-03', status: 'requested' }),
      ],
    } as unknown as ReturnType<typeof useMyBookings>);
    await renderWithLanguage(<MyBookingsScreen />);
    expect(useMyBookings).toHaveBeenCalledWith('u1');
    const refs = screen.getAllByTestId(/^my-booking-/).map((row) => row.props.testID);
    expect(refs).toEqual([
      'my-booking-ANT-NEXT01',
      'my-booking-ANT-REQU01',
      'my-booking-ANT-CANC01',
      'my-booking-ANT-PAST01',
    ]);
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('Past and cancelled')).toBeTruthy();
    expect(screen.getAllByText('Camping Thalassa · Tent pitch').length).toBe(3);
    expect(screen.getByText('Request sent')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('my-booking-ANT-NEXT01'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/bookings/detail',
      params: { ref: 'ANT-NEXT01' },
    });
  });

  it('invites to search when there are no bookings', async () => {
    signedIn();
    jest
      .mocked(useMyBookings)
      .mockReturnValue({ isPending: false, isError: false, data: [] } as unknown as ReturnType<
        typeof useMyBookings
      >);
    await renderWithLanguage(<MyBookingsScreen />);
    expect(screen.getByText('No bookings yet.')).toBeTruthy();
  });
});

describe('My booking', () => {
  const booking = {
    id: 'b1',
    ref: 'ANT-NEXT01',
    status: 'confirmed',
    can_cancel: true,
    arrival: '2027-07-10',
    departure: '2027-07-12',
    nights: 2,
    equipment: 'tent',
    party: { adult: 2 },
    extras: {},
    total_cents: 6200,
    price_breakdown: { nights: [], lines: [], totalCents: 6200 },
    payment_mode: 'on_site',
    cancellation_policy: 'flexible',
    request_expires_at: null,
    cancel_reason: null,
    created_at: '2027-06-01T10:00:00Z',
    guest: {
      name: 'Maria',
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
      address: null,
      lat: null,
      lng: null,
      phone: null,
      email: null,
      check_in_from: null,
      check_out_until: null,
    },
    pitch_type: { id: 'pt', name: { en: 'Tent pitch' } },
    names: { guest: { adult: { en: 'Adult' } }, extra: {}, fee: {} },
  } satisfies GuestBooking & { id: string };

  it('shows the booking and cancels it by id', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ ref: 'ANT-NEXT01' });
    jest
      .mocked(useMyBooking)
      .mockReturnValue({ isPending: false, isError: false, data: booking } as unknown as ReturnType<
        typeof useMyBooking
      >);
    const cancel = fakeMutation();
    jest
      .mocked(useCancelMyBooking)
      .mockReturnValue(cancel as unknown as ReturnType<typeof useCancelMyBooking>);
    await renderWithLanguage(<MyBookingScreen />);
    expect(useMyBooking).toHaveBeenCalledWith('ANT-NEXT01');
    expect(screen.getByText('Camping Thalassa · Tent pitch')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('booking-cancel'));
    await fireEvent.press(screen.getByTestId('booking-cancel-yes'));
    expect(cancel.mutate).toHaveBeenCalledWith('b1');
  });

  it("says when the booking isn't the user's", async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ ref: 'ANT-OTHER1' });
    jest
      .mocked(useMyBooking)
      .mockReturnValue({ isPending: false, isError: false, data: null } as unknown as ReturnType<
        typeof useMyBooking
      >);
    jest
      .mocked(useCancelMyBooking)
      .mockReturnValue(fakeMutation() as unknown as ReturnType<typeof useCancelMyBooking>);
    await renderWithLanguage(<MyBookingScreen />);
    expect(
      screen.getByText("We couldn't find this booking. Check that you opened the whole link."),
    ).toBeTruthy();
  });
});
