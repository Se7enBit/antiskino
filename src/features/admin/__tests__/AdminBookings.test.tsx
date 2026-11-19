import { fireEvent, screen } from '@testing-library/react-native';

import { useAdminBookings, type AdminBooking } from '@/api/admin';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { AdminBookings } from '../AdminBookings';

jest.mock('@/api/admin', () => ({ ADMIN_BOOKINGS_LIMIT: 500, useAdminBookings: jest.fn() }));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-07-10',
}));

const booking = (ref: string, patch: Partial<AdminBooking> = {}): AdminBooking => ({
  id: ref,
  ref,
  status: 'confirmed',
  arrival: '2027-07-12',
  departure: '2027-07-14',
  nights: 2,
  party_size: 3,
  guest_name: 'Maria Papadopoulou',
  total_cents: 9050,
  commission_cents: 543,
  created_at: '2027-06-01T10:00:00Z',
  camping: { name: 'Camping Thalassa' },
  ...patch,
});

function setup(list: AdminBooking[]) {
  jest.mocked(useAdminBookings).mockReturnValue({
    isPending: false,
    isError: false,
    data: list,
  } as unknown as ReturnType<typeof useAdminBookings>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Admin bookings', () => {
  it('lists every camping’s bookings with total and commission', async () => {
    setup([
      booking('ANT-AAAAAA'),
      booking('ANT-BBBBBB', { guest_name: 'John Smith', camping: { name: 'Camping Pefka' } }),
    ]);
    await renderWithLanguage(<AdminBookings />);
    expect(useAdminBookings).toHaveBeenCalledWith({ from: '2027-05-11', to: null });
    expect(screen.getByText('Bookings found: 2')).toBeTruthy();
    expect(screen.getByText('Camping Thalassa · Maria Papadopoulou')).toBeTruthy();
    expect(screen.getByText('Camping Pefka · John Smith')).toBeTruthy();
    expect(screen.getAllByText(/commission €5\.43/)).toHaveLength(2);
  });

  it('searches and filters like the partner list', async () => {
    setup([booking('ANT-AAAAAA'), booking('ANT-BBBBBB', { status: 'cancelled' })]);
    await renderWithLanguage(<AdminBookings />);
    await fireEvent.changeText(screen.getByTestId('booking-search'), 'bbbb');
    expect(screen.getByText('Bookings found: 1')).toBeTruthy();
    expect(screen.getByTestId('admin-booking-ANT-BBBBBB')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('booking-search'), '');
    await fireEvent.press(screen.getByTestId('toggle-filters'));
    await fireEvent.changeText(screen.getByTestId('range-from'), '1/8/2027');
    expect(useAdminBookings).toHaveBeenLastCalledWith({ from: '2027-08-01', to: null });
  });

  it('says when the list is cut at the limit', async () => {
    setup(Array.from({ length: 500 }, (_, i) => booking(`ANT-${String(i).padStart(6, '0')}`)));
    await renderWithLanguage(<AdminBookings />);
    expect(
      screen.getByText(
        'Showing the latest 500 stays in these dates. Narrow the dates to see others.',
      ),
    ).toBeTruthy();
  });
});
