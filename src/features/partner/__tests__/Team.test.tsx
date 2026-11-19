import { screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuth } from '@/api/auth';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { TeamScreen } from '../TeamScreen';

const mockCanEdit = { value: true };
jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../team/TeamManager', () => ({
  TeamManager: (props: { partnerId: string; defaultRole: string; selfId?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must require lazily
    const { Text } = require('react-native') as typeof import('react-native');
    return <Text>{`team ${props.partnerId} ${props.defaultRole} ${props.selfId ?? ''}`}</Text>;
  },
}));
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: {
      camping: { id: string; partner_id: string; name: string };
      canEdit: boolean;
    }) => ReactNode;
  }) =>
    children({
      camping: { id: 'c1', partner_id: 'p1', name: 'Camping Thalassa' },
      canEdit: mockCanEdit.value,
    }),
}));

beforeEach(async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'u1' } } as never,
  });
  await i18n.changeLanguage('en');
});

describe('Partner team', () => {
  it('lets owners manage the partner’s team, inviting staff', async () => {
    mockCanEdit.value = true;
    await renderWithLanguage(<TeamScreen />);
    expect(screen.getByText('team p1 staff u1')).toBeOnTheScreen();
  });

  it('tells staff that owners manage it', async () => {
    mockCanEdit.value = false;
    await renderWithLanguage(<TeamScreen />);
    expect(screen.getByText('Only owners manage the team.')).toBeOnTheScreen();
  });
});
