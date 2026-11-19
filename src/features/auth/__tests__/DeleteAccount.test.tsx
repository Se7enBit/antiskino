import { act, fireEvent, screen } from '@testing-library/react-native';

import { useDeleteAccount } from '@/api/account';
import { useAuth, type AuthStatus } from '@/api/auth';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { DeleteAccount } from '../DeleteAccount';

jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/account', () => ({ useDeleteAccount: jest.fn() }));

type Result = { deleted: true } | { deleted: false; reason: 'last_owner' };

function setup(status: AuthStatus, state: { data?: Result; isError?: boolean } = {}) {
  jest.mocked(useAuth).mockReturnValue({ status, session: null });
  const mutate = jest.fn();
  jest.mocked(useDeleteAccount).mockReturnValue({
    mutate,
    isPending: false,
    isError: state.isError ?? false,
    data: state.data,
  } as unknown as ReturnType<typeof useDeleteAccount>);
  return { mutate };
}

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('DeleteAccount', () => {
  it('asks once more before deleting', async () => {
    const { mutate } = setup('signedIn');
    await renderWithLanguage(<DeleteAccount />);
    expect(screen.getByText(/past bookings stay with the campings/)).toBeOnTheScreen();
    await act(() => fireEvent.press(screen.getByTestId('delete-account')));
    expect(
      screen.getByText("Delete your account for good? This can't be undone."),
    ).toBeOnTheScreen();
    expect(mutate).not.toHaveBeenCalled();
    await act(() => fireEvent.press(screen.getByTestId('delete-account-yes')));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('is hidden when nobody is signed in', async () => {
    setup('signedOut');
    await renderWithLanguage(<DeleteAccount />);
    expect(screen.queryByTestId('delete-account')).toBeNull();
  });

  it('tells the only owner of a team to hand it over first', async () => {
    setup('signedIn', { data: { deleted: false, reason: 'last_owner' } });
    await renderWithLanguage(<DeleteAccount />);
    expect(screen.getByText(/only owner of a camping's team/)).toBeOnTheScreen();
  });

  it('confirms the deletion after signing out', async () => {
    setup('signedOut', { data: { deleted: true } });
    await renderWithLanguage(<DeleteAccount />);
    expect(screen.getByText('Your account was deleted.')).toBeOnTheScreen();
  });

  it('shows an error when the deletion fails', async () => {
    setup('signedIn', { isError: true });
    await renderWithLanguage(<DeleteAccount />);
    expect(screen.getByText(i18n.t('common.error'))).toBeOnTheScreen();
  });
});
