import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useMyAccess } from '@/api/access';
import { useMyCampings } from '@/api/partner';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { PartnerProvider } from '../PartnerProvider';
import { PartnerScreen } from '../PartnerScreen';

jest.mock('@/api/access', () => ({ useMyAccess: jest.fn() }));
jest.mock('@/api/partner', () => ({ useMyCampings: jest.fn() }));

const campings = [
  { id: 'c1', name: 'Pefka', slug: 'pefka', status: 'live', partner_id: 'p1' },
  { id: 'c2', name: 'Thalassa', slug: 'thalassa', status: 'draft', partner_id: 'p2' },
];

function mockData(list: typeof campings) {
  jest.mocked(useMyAccess).mockReturnValue({
    data: {
      isAdmin: false,
      memberships: [
        { partnerId: 'p1', partnerName: 'One', role: 'owner' },
        { partnerId: 'p2', partnerName: 'Two', role: 'staff' },
      ],
    },
  } as unknown as ReturnType<typeof useMyAccess>);
  jest.mocked(useMyCampings).mockReturnValue({
    data: list,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useMyCampings>);
}

async function renderScreen() {
  await renderWithLanguage(
    <PartnerProvider>
      <PartnerScreen>
        {({ camping, canEdit }) => (
          <Text>
            {camping.name} {canEdit ? 'editable' : 'read-only'}
          </Text>
        )}
      </PartnerScreen>
    </PartnerProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('PartnerScreen', () => {
  it('shows the first camping and lets owners edit it', async () => {
    mockData(campings);
    await renderScreen();
    expect(screen.getByText('Pefka editable')).toBeOnTheScreen();
  });

  it('switches camping and applies the role of its partner', async () => {
    mockData(campings);
    await renderScreen();
    await fireEvent.press(screen.getByTestId('camping-switch-thalassa'));
    expect(screen.getByText('Thalassa read-only')).toBeOnTheScreen();
  });

  it('hides the switcher with a single camping', async () => {
    mockData(campings.slice(0, 1));
    await renderScreen();
    expect(screen.queryByTestId('camping-switch-pefka')).toBeNull();
  });

  it('explains when the team has no campings yet', async () => {
    mockData([]);
    await renderScreen();
    expect(
      screen.getByText('Your team has no campings yet. The Antiskino team adds them.'),
    ).toBeOnTheScreen();
  });
});
