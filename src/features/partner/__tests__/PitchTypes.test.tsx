import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Database } from '@/api/database.types';
import { useSetPitchTypePhotos, useUploadPhoto } from '@/api/photos';
import { usePitchTypes, useSavePitchType } from '@/api/pitchTypes';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { PitchTypesScreen } from '../PitchTypesScreen';

jest.mock('@/api/pitchTypes', () => ({ usePitchTypes: jest.fn(), useSavePitchType: jest.fn() }));
jest.mock('@/api/photos', () => ({
  photoUrl: (path: string) => `https://cdn.test/${path}`,
  useSetPitchTypePhotos: jest.fn(),
  useUploadPhoto: jest.fn(),
}));
let mockCanEdit = true;
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: { camping: { id: string }; canEdit: boolean }) => ReactNode;
  }) => children({ camping: { id: 'c1' }, canEdit: mockCanEdit }),
}));

type Row = Database['public']['Tables']['pitch_types']['Row'];
const row = (patch: Partial<Row>): Row => ({
  id: 'pt1',
  camping_id: 'c1',
  unit_category: 'pitch',
  name: { el: 'Θέση σκηνής', en: 'Tent pitch' },
  descr: {},
  included: { en: 'Showers and shared facilities' },
  accepts: ['tent'],
  max_people: 4,
  size_m2: 50,
  photos: ['c1/a.jpg'],
  active: true,
  sort: 0,
  created_at: '2026-11-16T10:00:00Z',
  updated_at: '2026-11-16T10:00:00Z',
  ...patch,
});

async function setup(list: Row[], canEdit = true) {
  mockCanEdit = canEdit;
  jest
    .mocked(usePitchTypes)
    .mockReturnValue({ isPending: false, data: list } as unknown as ReturnType<
      typeof usePitchTypes
    >);
  const save = fakeMutation<string>({ data: 'pt-new' });
  const setPhotos = fakeMutation();
  jest
    .mocked(useSavePitchType)
    .mockReturnValue(save as unknown as ReturnType<typeof useSavePitchType>);
  jest
    .mocked(useSetPitchTypePhotos)
    .mockReturnValue(setPhotos as unknown as ReturnType<typeof useSetPitchTypePhotos>);
  jest
    .mocked(useUploadPhoto)
    .mockReturnValue(fakeMutation() as unknown as ReturnType<typeof useUploadPhoto>);
  await renderWithLanguage(<PitchTypesScreen />);
  return { save, setPhotos };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Pitch types', () => {
  it('lists pitch types with their key facts', async () => {
    await setup([
      row({}),
      row({
        id: 'pt2',
        included: {},
        name: { el: 'Τροχόσπιτο' },
        accepts: ['caravan', 'camper'],
        max_people: 6,
        size_m2: null,
        active: false,
      }),
    ]);
    expect(screen.getByText('Tent pitch')).toBeOnTheScreen();
    expect(screen.getByText('Tent · People: 4 · 50 m²')).toBeOnTheScreen();
    expect(screen.getByText('Showers and shared facilities')).toBeOnTheScreen();
    // Falls back to Greek when there is no English name.
    expect(screen.getByText('Τροχόσπιτο')).toBeOnTheScreen();
    expect(screen.getByText('Caravan, Camper / motorhome · People: 6')).toBeOnTheScreen();
    expect(screen.getByText('Hidden')).toBeOnTheScreen();
  });

  it('adds a pitch type after validating it', async () => {
    const { save } = await setup([row({})]);
    await fireEvent.press(screen.getByTestId('pitch-add'));
    expect(screen.getByText('Save the pitch type first, then add photos.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('pitch-accepts-tent'));
    await fireEvent.changeText(screen.getByTestId('pitch-maxPeople'), '0');
    await fireEvent.press(screen.getByTestId('pitch-save'));
    expect(screen.getByText('Enter a name in at least one language.')).toBeOnTheScreen();
    expect(screen.getByText('Pick at least one kind of equipment.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a whole number from 1 to 50.')).toBeOnTheScreen();
    expect(save.mutate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('pitch-nameEl'), 'Θέση με ρεύμα');
    await fireEvent.press(screen.getByTestId('pitch-accepts-caravan'));
    await fireEvent.changeText(screen.getByTestId('pitch-maxPeople'), '6');
    await fireEvent.press(screen.getByTestId('pitch-save'));
    expect(save.mutate).toHaveBeenCalledWith(
      {
        id: undefined,
        sort: 1,
        values: {
          name: { el: 'Θέση με ρεύμα' },
          descr: {},
          included: {},
          accepts: ['caravan'],
          max_people: 6,
          size_m2: null,
          active: true,
        },
      },
      expect.any(Object),
    );
  });

  it('edits a pitch type and manages its photos', async () => {
    const { save, setPhotos } = await setup([row({})]);
    await fireEvent.press(screen.getByTestId('pitch-edit-pt1'));
    expect(screen.getByTestId('pitch-nameEn').props.value).toBe('Tent pitch');

    await fireEvent.press(screen.getByTestId('photo-remove-c1/a.jpg'));
    expect(setPhotos.mutate).toHaveBeenCalledWith({
      pitchTypeId: 'pt1',
      photos: [],
      removed: ['c1/a.jpg'],
    });

    await fireEvent.press(screen.getByTestId('pitch-visibility-hidden'));
    await fireEvent.press(screen.getByTestId('pitch-save'));
    expect(save.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pt1', values: expect.objectContaining({ active: false }) }),
      expect.any(Object),
    );
  });

  it('is read-only for staff', async () => {
    await setup([row({})], false);
    expect(screen.getByText("Only the camping's owners can change this.")).toBeOnTheScreen();
    expect(screen.queryByTestId('pitch-add')).toBeNull();
    expect(screen.queryByTestId('pitch-edit-pt1')).toBeNull();
  });
});
