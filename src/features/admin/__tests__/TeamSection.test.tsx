import { fireEvent, screen } from '@testing-library/react-native';

import { usePartnerTeam } from '@/api/admin';
import { useCreateInvite } from '@/api/invites';
import { i18n } from '@/i18n';

import { TeamSection } from '../TeamSection';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

jest.mock('@/api/admin', () => ({ usePartnerTeam: jest.fn() }));
jest.mock('@/api/invites', () => ({ useCreateInvite: jest.fn() }));

const token = 'ab'.repeat(32);

async function setup() {
  jest.mocked(usePartnerTeam).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      members: [
        { user_id: 'u1', role: 'owner', created_at: '2026-11-01T10:00:00Z', full_name: 'Maria P.' },
      ],
      invites: [
        {
          id: 'i1',
          email: 'staff@example.gr',
          role: 'staff',
          expires_at: '2099-01-02T10:00:00Z',
          accepted_at: null,
          created_at: '2098-12-26T10:00:00Z',
        },
      ],
    },
  } as unknown as ReturnType<typeof usePartnerTeam>);
  const create = fakeMutation<string>({ data: token });
  jest
    .mocked(useCreateInvite)
    .mockReturnValue(create as unknown as ReturnType<typeof useCreateInvite>);
  await renderWithLanguage(<TeamSection partnerId="p1" partnerName="Demo Campings" />);
  return { create };
}

const savedSiteUrl = process.env.EXPO_PUBLIC_SITE_URL;
beforeEach(async () => {
  await i18n.changeLanguage('en');
  process.env.EXPO_PUBLIC_SITE_URL = 'https://se7enbit.github.io/antiskino';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_SITE_URL = savedSiteUrl;
});

describe('TeamSection', () => {
  it('lists members and pending invites', async () => {
    await setup();
    expect(screen.getByText('Maria P. · Owner')).toBeOnTheScreen();
    expect(
      screen.getByText('staff@example.gr · Staff · Pending until 2 Jan 2099'),
    ).toBeOnTheScreen();
  });

  it('creates an owner invite and shows the link to share', async () => {
    const { create } = await setup();
    await fireEvent.changeText(screen.getByTestId('invite-email'), ' Owner@Example.GR ');
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { email: 'owner@example.gr', role: 'owner' },
      expect.any(Object),
    );
    expect(screen.getByTestId('invite-link').props.value).toBe(
      `https://se7enbit.github.io/antiskino/invite?t=${token}`,
    );
    expect(screen.getByTestId('invite-share')).toBeOnTheScreen();
  });

  it('can invite staff instead', async () => {
    const { create } = await setup();
    await fireEvent.changeText(screen.getByTestId('invite-email'), 'staff2@example.gr');
    await fireEvent.press(screen.getByTestId('invite-role-staff'));
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { email: 'staff2@example.gr', role: 'staff' },
      expect.any(Object),
    );
  });

  it('asks for a valid email', async () => {
    const { create } = await setup();
    await fireEvent.changeText(screen.getByTestId('invite-email'), 'owner');
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(create.mutate).not.toHaveBeenCalled();
  });
});
