import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  useCampingBookings,
  usePartnerBookingAction,
  type CampingBooking,
} from '@/api/partnerBookings';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { TodayScreen } from '../TodayScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/partnerBookings', () => ({
  useCampingBookings: jest.fn(),
  usePartnerBookingAction: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-10',
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
  equipment: 'tent',
  party_size: 2,
  total_cents: 5000,
  guest_name: `Guest ${ref}`,
  guest_email: 'guest@example.com',
  guest_phone: '+30 690 123 4567',
  guest_country: 'GR',
  guest_note: null,
  arrival_eta: null,
  vehicle_plate: null,
  request_expires_at: null,
  cancel_reason: null,
  assigned_pitch: null,
  created_at: '2027-06-01T10:00:00Z',
  pitch_type: { name: { en: 'Tent pitch' } },
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
  await renderWithLanguage(<TodayScreen />);
  return { action };
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2027-07-10T09:00:00Z') });
  await i18n.changeLanguage('en');
});

afterEach(() => jest.useRealTimers());

describe('Today', () => {
  it('loads the stays that end today or later', async () => {
    await setup([]);
    expect(useCampingBookings).toHaveBeenCalledWith('c1', { from: '2027-07-10', to: null });
    expect(screen.getByText('No arrivals today.')).toBeTruthy();
    expect(screen.getByText('No departures today.')).toBeTruthy();
  });

  it('counts arrivals, departures and who stays tonight', async () => {
    await setup([
      booking('ANT-ARR001'),
      booking('ANT-ARR002', { assigned_pitch: 'B12' }),
      booking('ANT-LEAVE1', {
        arrival: '2027-07-08',
        departure: '2027-07-10',
        status: 'checked_in',
      }),
      booking('ANT-STAY01', {
        arrival: '2027-07-09',
        departure: '2027-07-14',
        status: 'checked_in',
        party_size: 4,
      }),
    ]);
    expect(screen.getByLabelText('Arrivals: 2')).toBeTruthy();
    expect(screen.getByLabelText('Departures: 1')).toBeTruthy();
    expect(screen.getByLabelText('In house tonight: 1')).toBeTruthy();
    expect(screen.getByText('People: 4')).toBeTruthy();
  });

  it('warns about arrivals without a pitch and checks guests in', async () => {
    const { action } = await setup([
      booking('ANT-ARR001'),
      booking('ANT-ARR002', { assigned_pitch: 'B12' }),
    ]);
    expect(screen.getAllByText('No pitch assigned')).toHaveLength(1);
    expect(screen.getByText('Pitch B12')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('check-in-ANT-ARR001'));
    expect(action.mutate).toHaveBeenCalledWith({
      bookingId: 'ANT-ARR001',
      action: 'check_in',
      reason: undefined,
    });
  });

  it('shows requests with the time left to answer', async () => {
    await setup([
      booking('ANT-REQ001', {
        status: 'requested',
        arrival: '2027-08-01',
        departure: '2027-08-03',
        request_expires_at: '2027-07-10T12:20:00Z',
      }),
    ]);
    expect(screen.getByText('Requests to answer')).toBeTruthy();
    expect(screen.getByText('Answer by 10 Jul 2027, 15:20 · 3 h 20 min left')).toBeTruthy();
    expect(screen.getByTestId('accept-ANT-REQ001')).toBeTruthy();
  });
});
