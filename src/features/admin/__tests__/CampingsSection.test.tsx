import { fireEvent, screen } from '@testing-library/react-native';

import { useCreateCamping, useSetCampingStatus } from '@/api/admin';
import { i18n } from '@/i18n';

import { CampingsSection } from '../CampingsSection';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

jest.mock('@/api/admin', () => ({ useCreateCamping: jest.fn(), useSetCampingStatus: jest.fn() }));

const campings = [
  { id: 'c1', name: 'Thalassa', slug: 'thalassa', status: 'draft' as const, region: 'Halkidiki' },
  { id: 'c2', name: 'Pefka', slug: 'pefka', status: 'live' as const, region: null },
];

async function setup(createOutcome?: { error?: unknown }) {
  const setStatus = fakeMutation();
  const create = fakeMutation(createOutcome);
  jest
    .mocked(useSetCampingStatus)
    .mockReturnValue(setStatus as unknown as ReturnType<typeof useSetCampingStatus>);
  jest
    .mocked(useCreateCamping)
    .mockReturnValue(create as unknown as ReturnType<typeof useCreateCamping>);
  await renderWithLanguage(<CampingsSection partnerId="p1" campings={campings} />);
  return { setStatus, create };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('CampingsSection', () => {
  it('lists campings with their status and the matching actions', async () => {
    const { setStatus } = await setup();
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('Live')).toBeOnTheScreen();
    expect(screen.getByText('/c/thalassa · Halkidiki')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('camping-thalassa-live'));
    expect(setStatus.mutate).toHaveBeenCalledWith({ campingId: 'c1', status: 'live' });
    await fireEvent.press(screen.getByTestId('camping-pefka-paused'));
    expect(setStatus.mutate).toHaveBeenCalledWith({ campingId: 'c2', status: 'paused' });
  });

  it('suggests a web address from a Greek name and creates the camping', async () => {
    const { create } = await setup();
    await fireEvent.press(screen.getByTestId('camping-add'));
    await fireEvent.changeText(screen.getByTestId('camping-name'), 'Κάμπινγκ Θάλασσα');
    expect(screen.getByTestId('camping-slug').props.value).toBe('kampingk-thalassa');
    await fireEvent.changeText(screen.getByTestId('camping-region'), 'Χαλκιδική');
    await fireEvent.press(screen.getByTestId('camping-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { name: 'Κάμπινγκ Θάλασσα', slug: 'kampingk-thalassa', region: 'Χαλκιδική' },
      expect.any(Object),
    );
  });

  it('rejects an invalid web address before saving', async () => {
    const { create } = await setup();
    await fireEvent.press(screen.getByTestId('camping-add'));
    await fireEvent.changeText(screen.getByTestId('camping-name'), 'Thalassa');
    await fireEvent.changeText(screen.getByTestId('camping-slug'), 'Thalassa Beach');
    await fireEvent.press(screen.getByTestId('camping-create'));
    expect(screen.getByText('Use lowercase Latin letters, digits and dashes.')).toBeOnTheScreen();
    expect(create.mutate).not.toHaveBeenCalled();
  });

  it('explains a web address that is already taken', async () => {
    await setup({ error: { code: '23505' } });
    await fireEvent.press(screen.getByTestId('camping-add'));
    await fireEvent.changeText(screen.getByTestId('camping-name'), 'Thalassa');
    await fireEvent.press(screen.getByTestId('camping-create'));
    expect(screen.getByText('This web address is already taken.')).toBeOnTheScreen();
  });
});
