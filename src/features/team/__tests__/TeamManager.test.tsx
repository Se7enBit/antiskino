import { fireEvent, screen } from '@testing-library/react-native';

import { useCreateInvite } from '@/api/invites';
import { useTeam, useTeamChange } from '@/api/team';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { TeamManager } from '../TeamManager';

jest.mock('@/api/team', () => ({ useTeam: jest.fn(), useTeamChange: jest.fn() }));
jest.mock('@/api/invites', () => ({ useCreateInvite: jest.fn() }));

const token = 'ab'.repeat(32);

function setup(changeOutcome: { error?: unknown } = {}) {
  jest.mocked(useTeam).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      members: [
        {
          user_id: 'u1',
          role: 'owner',
          full_name: 'Maria P.',
          email: 'maria@example.gr',
          created_at: '2026-11-01T10:00:00Z',
        },
        {
          user_id: 'u2',
          role: 'staff',
          full_name: null,
          email: 'nikos@example.gr',
          created_at: '2026-11-02T10:00:00Z',
        },
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
        {
          id: 'i2',
          email: 'nikos@example.gr',
          role: 'staff',
          expires_at: '2026-11-09T10:00:00Z',
          accepted_at: '2026-11-02T10:00:00Z',
          created_at: '2026-11-02T09:00:00Z',
        },
      ],
    },
  } as unknown as ReturnType<typeof useTeam>);
  const change = fakeMutation(changeOutcome);
  jest.mocked(useTeamChange).mockReturnValue(change as unknown as ReturnType<typeof useTeamChange>);
  const create = fakeMutation<string>({ data: token });
  jest
    .mocked(useCreateInvite)
    .mockReturnValue(create as unknown as ReturnType<typeof useCreateInvite>);
  return { change, create };
}

const savedSiteUrl = process.env.EXPO_PUBLIC_SITE_URL;
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
  process.env.EXPO_PUBLIC_SITE_URL = 'https://se7enbit.github.io/antiskino';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_SITE_URL = savedSiteUrl;
});

describe('TeamManager', () => {
  it('lists members with email and role, and pending invites only', async () => {
    setup();
    await renderWithLanguage(
      <TeamManager partnerId="p1" partnerName="Demo" defaultRole="staff" selfId="u1" />,
    );
    expect(useTeam).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Maria P. · Owner · you')).toBeOnTheScreen();
    expect(screen.getByText('maria@example.gr')).toBeOnTheScreen();
    expect(screen.getByText('Name not set · Staff')).toBeOnTheScreen();
    expect(
      screen.getByText('staff@example.gr · Staff · Pending until 2 Jan 2099'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('invite-i2')).toBeNull();
  });

  it('changes roles, removes after confirming and revokes invites', async () => {
    const { change } = setup();
    await renderWithLanguage(<TeamManager partnerId="p1" partnerName="Demo" defaultRole="staff" />);
    await fireEvent.press(screen.getByTestId('member-role-u2'));
    expect(change.mutate).toHaveBeenLastCalledWith({ kind: 'role', userId: 'u2', role: 'owner' });
    await fireEvent.press(screen.getByTestId('member-remove-u2'));
    expect(screen.getByText('Remove nikos@example.gr from the team?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-remove-u2-yes'));
    expect(change.mutate).toHaveBeenLastCalledWith({ kind: 'remove', userId: 'u2' });
    await fireEvent.press(screen.getByTestId('invite-revoke-i1'));
    expect(change.mutate).toHaveBeenLastCalledWith({ kind: 'revoke', inviteId: 'i1' });
  });

  it('explains that the team needs an owner', async () => {
    setup({ error: { code: 'ANT04' } });
    await renderWithLanguage(<TeamManager partnerId="p1" partnerName="Demo" defaultRole="staff" />);
    expect(
      screen.getByText('The team needs at least one owner. Make someone else owner first.'),
    ).toBeOnTheScreen();
  });

  it('invites staff by default for owners, and shows the link to share', async () => {
    const { create } = setup();
    await renderWithLanguage(<TeamManager partnerId="p1" partnerName="Demo" defaultRole="staff" />);
    await fireEvent.changeText(screen.getByTestId('invite-email'), ' New@Example.GR ');
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { email: 'new@example.gr', role: 'staff' },
      expect.any(Object),
    );
    expect(screen.getByTestId('invite-link').props.value).toBe(
      `https://se7enbit.github.io/antiskino/invite?t=${token}`,
    );
  });

  it('invites an owner by default for admins, and asks for a valid email', async () => {
    const { create } = setup();
    await renderWithLanguage(<TeamManager partnerId="p1" partnerName="Demo" defaultRole="owner" />);
    await fireEvent.changeText(screen.getByTestId('invite-email'), 'owner');
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('invite-email'), 'owner@example.gr');
    await fireEvent.press(screen.getByTestId('invite-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { email: 'owner@example.gr', role: 'owner' },
      expect.any(Object),
    );
  });
});
