import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useCreatePartner } from '@/api/admin';
import { i18n } from '@/i18n';

import { PartnerForm } from '../PartnerForm';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

jest.mock('@/api/admin', () => ({ useCreatePartner: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.mocked(router.replace).mockClear();
});

function setup(outcome?: Parameters<typeof fakeMutation<string>>[0]) {
  const create = fakeMutation<string>(outcome ?? { data: 'new-partner-id' });
  jest
    .mocked(useCreatePartner)
    .mockReturnValue(create as unknown as ReturnType<typeof useCreatePartner>);
  return create;
}

describe('PartnerForm', () => {
  it('shows a message per invalid field and does not save', async () => {
    const create = setup();
    await renderWithLanguage(<PartnerForm />);
    await fireEvent.changeText(screen.getByTestId('partner-billingEmail'), 'nope');
    await fireEvent.changeText(screen.getByTestId('partner-commissionPercent'), '120');
    await fireEvent.press(screen.getByTestId('partner-submit'));
    expect(screen.getByText('Enter the company name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email or leave it empty.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a percentage from 0 to 100, e.g. 6 or 5.5.')).toBeOnTheScreen();
    expect(create.mutate).not.toHaveBeenCalled();
  });

  it('creates the partner and opens its page', async () => {
    const create = setup();
    await renderWithLanguage(<PartnerForm />);
    await fireEvent.changeText(screen.getByTestId('partner-name'), 'Demo Campings');
    await fireEvent.changeText(screen.getByTestId('partner-commissionPercent'), '5,5');
    await fireEvent.press(screen.getByTestId('partner-submit'));
    expect(create.mutate).toHaveBeenCalledWith(
      {
        name: 'Demo Campings',
        legal_name: null,
        vat_number: null,
        billing_email: null,
        commission_bps: 550,
      },
      expect.any(Object),
    );
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/admin/partner',
      params: { id: 'new-partner-id' },
    });
  });

  it('reports a failed save', async () => {
    setup({ error: new Error('offline') });
    await renderWithLanguage(<PartnerForm />);
    await fireEvent.changeText(screen.getByTestId('partner-name'), 'Demo Campings');
    await fireEvent.press(screen.getByTestId('partner-submit'));
    expect(
      screen.getByText('Something went wrong. Check your connection and try again.'),
    ).toBeOnTheScreen();
  });
});
