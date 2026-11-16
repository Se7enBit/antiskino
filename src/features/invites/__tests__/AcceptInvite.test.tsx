import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { useAuth, useRequestCode, useSignOut, useVerifyCode, type AuthStatus } from '@/api/auth';
import { useAcceptInvite } from '@/api/invites';
import type { AcceptInviteResult } from '@/domain/invites';
import { LanguageProvider, i18n } from '@/i18n';

import { AcceptInvite } from '../AcceptInvite';

jest.mock('@/api/auth', () => ({
  useAuth: jest.fn(),
  useSignOut: jest.fn(),
  useRequestCode: jest.fn(),
  useVerifyCode: jest.fn(),
}));
jest.mock('@/api/invites', () => ({ useAcceptInvite: jest.fn() }));

const token = 'ab'.repeat(32);

function mockState(status: AuthStatus, result?: AcceptInviteResult) {
  const idle = { mutate: jest.fn(), isPending: false };
  jest.mocked(useAuth).mockReturnValue({ status, session: null });
  jest.mocked(useSignOut).mockReturnValue(idle as unknown as ReturnType<typeof useSignOut>);
  jest.mocked(useRequestCode).mockReturnValue(idle as unknown as ReturnType<typeof useRequestCode>);
  jest.mocked(useVerifyCode).mockReturnValue(idle as unknown as ReturnType<typeof useVerifyCode>);
  const accept = { mutate: jest.fn(), isPending: false, isError: false, data: result };
  jest
    .mocked(useAcceptInvite)
    .mockReturnValue(accept as unknown as ReturnType<typeof useAcceptInvite>);
  return { accept };
}

async function renderPage(withToken = true) {
  await renderRouter({
    index: () => (
      <LanguageProvider>
        <AcceptInvite token={withToken ? token : undefined} />
      </LanguageProvider>
    ),
    partner: () => null,
  });
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AcceptInvite', () => {
  it('asks a signed-out visitor to sign in first', async () => {
    mockState('signedOut');
    await renderPage();
    expect(
      screen.getByText('Sign in with the email address the invitation was sent to.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-email')).toBeOnTheScreen();
  });

  it('accepts the invitation for a signed-in user', async () => {
    const { accept } = mockState('signedIn');
    await renderPage();
    await fireEvent.press(screen.getByTestId('invite-accept'));
    expect(accept.mutate).toHaveBeenCalledWith(token);
  });

  it('links to the partner area once accepted', async () => {
    mockState('signedIn', {
      status: 'accepted',
      partner_id: '0b6f2f1e-8a51-4f3e-9b8d-2a6c1d7e9f00',
    });
    await renderPage();
    expect(screen.getByText("You're on the team now.")).toBeOnTheScreen();
    expect(screen.getByText('Open the partner area')).toBeOnTheScreen();
  });

  it.each([
    ['used', 'This invitation has already been used.'],
    ['expired', 'This invitation has expired. Ask for a new one.'],
    ['invalid', "This invitation link isn't valid. Make sure you opened the whole link."],
  ] as const)('explains a %s invitation', async (status, message) => {
    mockState('signedIn', { status });
    await renderPage();
    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  it('offers to sign out when the email does not match', async () => {
    mockState('signedIn', { status: 'wrong_email' });
    await renderPage();
    expect(
      screen.getByText(
        'This invitation was sent to a different email address. Sign out and sign in with that address.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('invite-sign-out')).toBeOnTheScreen();
  });

  it('rejects a missing or malformed token', async () => {
    mockState('signedIn');
    await renderPage(false);
    expect(
      screen.getByText("This invitation link isn't valid. Make sure you opened the whole link."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('invite-accept')).toBeNull();
  });
});
