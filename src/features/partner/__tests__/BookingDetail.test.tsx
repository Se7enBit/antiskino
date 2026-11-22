import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  usePartnerBooking,
  usePartnerBookingAction,
  useUpdateBookingDesk,
  type PartnerBooking,
} from '@/api/partnerBookings';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { BookingDetailScreen } from '../BookingDetailScreen';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('@/api/partnerBookings', () => ({
  usePartnerBooking: jest.fn(),
  usePartnerBookingAction: jest.fn(),
  useUpdateBookingDesk: jest.fn(),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-10',
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
  party: { adult: 2, child: 1 },
  party_size: 3,
  extras: {},
  total_cents: 9050,
  price_breakdown: {
    nights: [],
    lines: [],
    totalCents: 9050,
    names: {
      pitch: { en: 'Tent pitch' },
      guest: { adult: { en: 'Adult' }, child: { en: 'Child 4–11' } },
      extra: {},
      fee: {},
    },
  },
  payment_mode: 'on_site',
  cancellation_policy: 'flexible',
  commission_cents: 543,
  guest_name: 'Maria Papadopoulou',
  guest_email: 'maria@example.com',
  guest_phone: '+30 690 123 4567',
  guest_country: 'GR',
  locale: 'el',
  guest_note: null,
  arrival_eta: '17:00:00',
  vehicle_plate: null,
  request_expires_at: null,
  cancel_reason: null,
  assigned_pitch: null,
  internal_note: null,
  created_at: '2027-06-01T10:00:00Z',
  pitch_type: { name: { en: 'Tent pitch (today)' } },
  events: [
    {
      id: 1,
      at: '2027-06-01T10:00:00Z',
      actor_kind: 'guest',
      from_status: null,
      to_status: 'confirmed',
      note: null,
    },
  ],
};

function setup(booking: PartnerBooking | null = BOOKING) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ ref: 'ANT-7KQ2XM' });
  jest.mocked(usePartnerBooking).mockReturnValue({
    isPending: false,
    isError: false,
    data: booking,
  } as unknown as ReturnType<typeof usePartnerBooking>);
  const action = fakeMutation();
  jest
    .mocked(usePartnerBookingAction)
    .mockReturnValue(action as unknown as ReturnType<typeof usePartnerBookingAction>);
  const desk = fakeMutation();
  jest
    .mocked(useUpdateBookingDesk)
    .mockReturnValue(desk as unknown as ReturnType<typeof useUpdateBookingDesk>);
  return { action, desk };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Partner booking detail', () => {
  it('shows the guest, the stay, the price and the history', async () => {
    setup();
    await renderWithLanguage(<BookingDetailScreen />);
    expect(usePartnerBooking).toHaveBeenCalledWith('ANT-7KQ2XM');
    expect(screen.getAllByText('Maria Papadopoulou').length).toBeGreaterThan(0);
    expect(screen.getByText('No pitch assigned')).toBeTruthy();
    expect(screen.getByText('Country: Greece · Language: Greek')).toBeTruthy();
    expect(screen.getByText('Arrives around 17:00')).toBeTruthy();
    expect(screen.getByText(/Adult: 2 · Child 4–11: 1/)).toBeTruthy();
    expect(screen.getByText(/Tent pitch$/)).toBeTruthy();
    expect(screen.getByText('Pays at the camping: €90.50')).toBeTruthy();
    expect(screen.getByText('Antiskino commission: €5.43')).toBeTruthy();
    expect(screen.getByTestId('event-confirmed')).toBeTruthy();
    expect(screen.getByText('Confirmed · by the guest')).toBeTruthy();
  });

  it('checks the guest in on the arrival day', async () => {
    const { action } = setup();
    await renderWithLanguage(<BookingDetailScreen />);
    // Screen readers hear whose booking the button is for.
    expect(screen.getByLabelText('Check in: Maria Papadopoulou')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('check-in-ANT-7KQ2XM'));
    expect(action.mutate).toHaveBeenCalledWith({
      bookingId: 'b1',
      action: 'check_in',
      reason: undefined,
    });
  });

  it('explains when check-in opens for a later arrival', async () => {
    setup({ ...BOOKING, arrival: '2027-07-20', departure: '2027-07-22' });
    await renderWithLanguage(<BookingDetailScreen />);
    expect(screen.queryByTestId('check-in-ANT-7KQ2XM')).toBeNull();
    expect(
      screen.getByText('Check-in and no-show are possible from the arrival day.'),
    ).toBeTruthy();
  });

  it('saves the pitch number and the internal note', async () => {
    const { desk } = setup();
    await renderWithLanguage(<BookingDetailScreen />);
    expect(screen.getByTestId('desk-save').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('desk-pitch'), 'B12');
    await fireEvent.changeText(screen.getByTestId('desk-note'), 'Near the showers');
    await fireEvent.press(screen.getByTestId('desk-save'));
    expect(desk.mutate).toHaveBeenCalledWith({
      bookingId: 'b1',
      assignedPitch: 'B12',
      internalNote: 'Near the showers',
    });
  });

  it('shows the assigned pitch', async () => {
    setup({ ...BOOKING, assigned_pitch: 'B12', internal_note: 'Near the showers' });
    await renderWithLanguage(<BookingDetailScreen />);
    expect(screen.getByText('Pitch B12')).toBeTruthy();
    expect(screen.getByTestId('desk-pitch').props.value).toBe('B12');
  });

  it('asks for a pitch only for a stay that is coming or under way', async () => {
    setup({ ...BOOKING, status: 'cancelled', cancel_reason: 'Plans changed' });
    await renderWithLanguage(<BookingDetailScreen />);
    expect(screen.getByText('Reason: Plans changed')).toBeTruthy();
    expect(screen.queryByText('No pitch assigned')).toBeNull();
  });

  it('says when the booking is not the team’s', async () => {
    setup(null);
    await renderWithLanguage(<BookingDetailScreen />);
    expect(screen.getByText("We couldn't find this booking.")).toBeTruthy();
  });
});
