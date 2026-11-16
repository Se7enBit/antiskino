import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useMyAccess, type MyAccess } from '@/api/access';
import { useAuth, useSignOut, type AuthStatus } from '@/api/auth';
import { LanguageProvider, i18n } from '@/i18n';

import { AccountSignIn } from '../AccountSignIn';
import { AreaLinks } from '../AreaLinks';
import { RequireAccess } from '../RequireAccess';

jest.mock('@/api/auth', () => ({ useAuth: jest.fn(), useSignOut: jest.fn() }));
jest.mock('@/api/access', () => ({
  ...jest.requireActual('@/api/access'),
  useMyAccess: jest.fn(),
}));

const member: MyAccess = {
  isAdmin: false,
  memberships: [{ partnerId: 'p1', partnerName: 'Demo Campings', role: 'staff' }],
};
const admin: MyAccess = { isAdmin: true, memberships: [] };
const nobody: MyAccess = { isAdmin: false, memberships: [] };

function mockState(status: AuthStatus, access?: MyAccess | 'pending' | 'error') {
  const signOut = { mutate: jest.fn(), isPending: false };
  jest.mocked(useSignOut).mockReturnValue(signOut as unknown as ReturnType<typeof useSignOut>);
  jest.mocked(useAuth).mockReturnValue({
    status,
    session:
      status === 'signedIn'
        ? ({ user: { id: 'u1', email: 'maria@example.gr' } } as ReturnType<
            typeof useAuth
          >['session'])
        : null,
  });
  jest.mocked(useMyAccess).mockReturnValue({
    data: typeof access === 'object' ? access : undefined,
    isPending: access === 'pending' || access === undefined,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useMyAccess>);
  return { signOut };
}

async function renderInApp(element: React.ReactElement) {
  await renderRouter({
    index: () => <LanguageProvider>{element}</LanguageProvider>,
    account: () => null,
  });
}

const gated = (area: 'partner' | 'admin') => (
  <RequireAccess area={area}>
    <Text>Inside the area</Text>
  </RequireAccess>
);

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('RequireAccess', () => {
  it('waits while the session or the roles load', async () => {
    mockState('loading');
    await renderInApp(gated('partner'));
    expect(screen.getByText('Loading…')).toBeOnTheScreen();

    mockState('signedIn', 'pending');
    await renderInApp(gated('partner'));
    expect(screen.getByText('Loading…')).toBeOnTheScreen();
  });

  it.each<AuthStatus>(['signedOut', 'unconfigured'])('asks to sign in when %s', async (status) => {
    mockState(status);
    await renderInApp(gated('partner'));
    expect(screen.getByText('Sign in to continue')).toBeOnTheScreen();
    expect(screen.getByText('Go to sign in')).toBeOnTheScreen();
    expect(screen.queryByText('Inside the area')).toBeNull();
  });

  it('lets partner members into the partner area', async () => {
    mockState('signedIn', member);
    await renderInApp(gated('partner'));
    expect(screen.getByText('Inside the area')).toBeOnTheScreen();
  });

  it('keeps users without a partner out of the partner area', async () => {
    mockState('signedIn', nobody);
    await renderInApp(gated('partner'));
    expect(screen.getByText('No access')).toBeOnTheScreen();
    expect(screen.queryByText('Inside the area')).toBeNull();
  });

  it('lets only admins into the admin area', async () => {
    mockState('signedIn', admin);
    await renderInApp(gated('admin'));
    expect(screen.getByText('Inside the area')).toBeOnTheScreen();

    mockState('signedIn', member);
    await renderInApp(gated('admin'));
    expect(screen.getByText('This area is for the Antiskino team.')).toBeOnTheScreen();
  });

  it('offers a retry when the roles cannot be loaded', async () => {
    mockState('signedIn', 'error');
    jest.mocked(useMyAccess).mockReturnValue({
      data: undefined,
      isPending: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useMyAccess>);
    await renderInApp(gated('partner'));
    expect(screen.getByText("Couldn't check your access.")).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });
});

describe('AreaLinks', () => {
  it('shows only the areas the user may enter', async () => {
    mockState('signedIn', member);
    await renderInApp(<AreaLinks />);
    expect(screen.getByText('Partner area')).toBeOnTheScreen();
    expect(screen.queryByText('Platform admin')).toBeNull();
  });

  it('shows nothing to a camper', async () => {
    mockState('signedIn', nobody);
    await renderInApp(<AreaLinks />);
    expect(screen.queryByText('Other areas')).toBeNull();
  });
});

describe('AccountSignIn', () => {
  it('shows who is signed in and signs out', async () => {
    const { signOut } = mockState('signedIn', nobody);
    await renderInApp(<AccountSignIn />);
    expect(screen.getByText('Signed in as maria@example.gr')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(signOut.mutate).toHaveBeenCalled();
  });

  it('explains when sign-in is not configured', async () => {
    mockState('unconfigured');
    await renderInApp(<AccountSignIn />);
    expect(screen.getByText("Sign-in isn't available in this build yet.")).toBeOnTheScreen();
  });
});
