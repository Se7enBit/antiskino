import { act, fireEvent, screen } from '@testing-library/react-native';

import { useMyAccess, type MyAccess } from '@/api/access';
import { useMutedEmails, useSetMutedEmails, type MutableEmail } from '@/api/emailSettings';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { EmailSettings } from '../EmailSettings';

jest.mock('@/api/access', () => ({ useMyAccess: jest.fn() }));
jest.mock('@/api/emailSettings', () => ({
  ...jest.requireActual('@/api/emailSettings'),
  useMutedEmails: jest.fn(),
  useSetMutedEmails: jest.fn(),
}));

const member: MyAccess = {
  isAdmin: false,
  memberships: [{ partnerId: 'p1', partnerName: 'Demo Campings', role: 'staff' }],
};

function setup(access: MyAccess, muted: MutableEmail[]) {
  jest.mocked(useMyAccess).mockReturnValue({ data: access } as ReturnType<typeof useMyAccess>);
  jest
    .mocked(useMutedEmails)
    .mockReturnValue({ data: muted } as unknown as ReturnType<typeof useMutedEmails>);
  const mutate = jest.fn();
  jest.mocked(useSetMutedEmails).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSetMutedEmails>);
  return { mutate };
}

const checked = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.checked as boolean;

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('EmailSettings', () => {
  it('shows the kinds a member gets and turns one off', async () => {
    const { mutate } = setup(member, ['booking_cancelled']);
    await renderWithLanguage(<EmailSettings />);
    expect(screen.getByText('Booking emails')).toBeOnTheScreen();
    expect(checked('email-booking_confirmed')).toBe(true);
    expect(checked('email-booking_cancelled')).toBe(false);
    await act(() => fireEvent.press(screen.getByTestId('email-request_received')));
    expect(mutate).toHaveBeenCalledWith(['booking_cancelled', 'request_received']);
  });

  it('turns a muted kind back on', async () => {
    const { mutate } = setup(member, ['booking_cancelled', 'request_received']);
    await renderWithLanguage(<EmailSettings />);
    await act(() => fireEvent.press(screen.getByTestId('email-booking_cancelled')));
    expect(mutate).toHaveBeenCalledWith(['request_received']);
  });

  it('is only for partner members', async () => {
    setup({ isAdmin: true, memberships: [] }, []);
    await renderWithLanguage(<EmailSettings />);
    expect(screen.queryByText('Booking emails')).toBeNull();
  });
});
