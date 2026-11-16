import { fireEvent, screen } from '@testing-library/react-native';

import type { Database } from '@/api/database.types';
import { useUpdateCampingProfile } from '@/api/partner';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { CampingProfileForm } from '../CampingProfileForm';

jest.mock('@/api/partner', () => ({ useUpdateCampingProfile: jest.fn() }));

const camping: Database['public']['Tables']['campings']['Row'] = {
  id: 'c1',
  partner_id: 'p1',
  slug: 'thalassa',
  status: 'draft',
  name: 'Thalassa',
  short_descr: {},
  descr: {},
  house_rules: {},
  region: null,
  address: null,
  lat: null,
  lng: null,
  phone: null,
  email: null,
  amenities: ['wifi'],
  check_in_from: null,
  check_out_until: null,
  same_day_cutoff: '14:00:00',
  confirmation_mode: 'instant',
  request_expiry_hours: 24,
  payment_mode: 'on_site',
  deposit_percent: null,
  cancellation_policy: 'flexible',
  created_at: '2026-11-16T10:00:00Z',
  updated_at: '2026-11-16T10:00:00Z',
};

async function setup(canEdit = true) {
  const save = fakeMutation();
  jest
    .mocked(useUpdateCampingProfile)
    .mockReturnValue(save as unknown as ReturnType<typeof useUpdateCampingProfile>);
  await renderWithLanguage(<CampingProfileForm camping={camping} canEdit={canEdit} />);
  return save;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('CampingProfileForm', () => {
  it("saves the owner's changes as camping columns", async () => {
    const save = await setup();
    await fireEvent.changeText(screen.getByTestId('profile-shortDescrEl'), 'Σκιά και θάλασσα.');
    await fireEvent.changeText(screen.getByTestId('profile-coordinates'), '40.0915, 23.98');
    await fireEvent.changeText(screen.getByTestId('profile-checkInFrom'), '15:00');
    await fireEvent.press(screen.getByTestId('profile-amenity-pool'));
    await fireEvent.press(screen.getByTestId('profile-amenity-wifi'));
    await fireEvent.press(screen.getByTestId('profile-confirmation-request'));
    await fireEvent.changeText(screen.getByTestId('profile-requestExpiryHours'), '12');
    await fireEvent.press(screen.getByTestId('profile-cancellation-strict'));
    await fireEvent.press(screen.getByTestId('profile-save'));

    expect(save.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        short_descr: { el: 'Σκιά και θάλασσα.' },
        lat: 40.0915,
        lng: 23.98,
        check_in_from: '15:00',
        amenities: ['pool'],
        confirmation_mode: 'request',
        request_expiry_hours: 12,
        cancellation_policy: 'strict',
        payment_mode: 'on_site',
      }),
    );
  });

  it('explains the cancellation presets in plain words', async () => {
    await setup();
    expect(screen.getByText('Full refund up to the day before arrival.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-cancellation-moderate'));
    expect(
      screen.getByText('Full refund up to 7 days before arrival, 50% from 6 to 1 day before.'),
    ).toBeOnTheScreen();
  });

  it('shows field errors instead of saving', async () => {
    const save = await setup();
    await fireEvent.changeText(screen.getByTestId('profile-coordinates'), 'Sarti beach');
    await fireEvent.changeText(screen.getByTestId('profile-sameDayCutoff'), '2pm');
    await fireEvent.press(screen.getByTestId('profile-save'));
    expect(screen.getByText('Write "latitude, longitude", e.g. 40.0915, 23.98.')).toBeOnTheScreen();
    expect(screen.getByText('Write a time like 14:00.')).toBeOnTheScreen();
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it('keeps online payment modes disabled', async () => {
    await setup();
    expect(screen.getByTestId('profile-payment-deposit')).toBeDisabled();
    expect(screen.getByTestId('profile-payment-full')).toBeDisabled();
    expect(screen.getByTestId('profile-payment-on_site')).toBeEnabled();
  });

  it('is read-only for staff', async () => {
    await setup(false);
    expect(screen.getByText("Only the camping's owners can change this.")).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-save')).toBeNull();
    expect(screen.getByTestId('profile-name').props.editable).toBe(false);
    expect(screen.getByTestId('profile-amenity-pool')).toBeDisabled();
  });
});
