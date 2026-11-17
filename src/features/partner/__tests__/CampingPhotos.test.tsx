import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import {
  useAddCampingPhoto,
  useCampingPhotos,
  useRemoveCampingPhoto,
  useUploadPhoto,
} from '@/api/photos';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { CampingPhotos } from '../CampingPhotos';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/api/photos', () => ({
  photoUrl: (path: string) => `https://cdn.test/${path}`,
  useCampingPhotos: jest.fn(),
  useAddCampingPhoto: jest.fn(),
  useRemoveCampingPhoto: jest.fn(),
  useUploadPhoto: jest.fn(),
}));

async function setup() {
  jest.mocked(useCampingPhotos).mockReturnValue({
    isPending: false,
    isError: false,
    data: [
      { id: 'ph1', storage_path: 'c1/beach.jpg', sort: 0 },
      { id: 'ph2', storage_path: 'c1/pines.jpg', sort: 3 },
    ],
  } as unknown as ReturnType<typeof useCampingPhotos>);
  const add = fakeMutation();
  const remove = fakeMutation();
  jest
    .mocked(useAddCampingPhoto)
    .mockReturnValue(add as unknown as ReturnType<typeof useAddCampingPhoto>);
  jest
    .mocked(useRemoveCampingPhoto)
    .mockReturnValue(remove as unknown as ReturnType<typeof useRemoveCampingPhoto>);
  jest
    .mocked(useUploadPhoto)
    .mockReturnValue(
      fakeMutation<string>({ data: 'c1/new.jpg' }) as unknown as ReturnType<typeof useUploadPhoto>,
    );
  await renderWithLanguage(<CampingPhotos campingId="c1" canEdit />);
  return { add, remove };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('CampingPhotos', () => {
  it('adds an uploaded photo after the last one', async () => {
    const { add } = await setup();
    jest.mocked(launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///x.jpg', mimeType: 'image/jpeg' }],
    } as never);
    await fireEvent.press(screen.getByTestId('photo-add'));
    await waitFor(() => expect(add.mutate).toHaveBeenCalledWith({ path: 'c1/new.jpg', sort: 4 }));
  });

  it('removes a photo row and its file', async () => {
    const { remove } = await setup();
    await fireEvent.press(screen.getByTestId('photo-remove-ph1'));
    expect(remove.mutate).toHaveBeenCalledWith({ id: 'ph1', path: 'c1/beach.jpg' });
  });
});
