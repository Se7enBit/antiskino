import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { useUploadPhoto } from '@/api/photos';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { PhotoGrid } from '../PhotoGrid';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/api/photos', () => ({
  photoUrl: (path: string) => `https://cdn.test/${path}`,
  useUploadPhoto: jest.fn(),
}));

const picked = (asset: Record<string, unknown>) =>
  jest
    .mocked(launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [asset] } as never);

async function setup(canEdit = true) {
  const upload = fakeMutation<string>({ data: 'c1/new.jpg' });
  jest
    .mocked(useUploadPhoto)
    .mockReturnValue(upload as unknown as ReturnType<typeof useUploadPhoto>);
  const onAdd = jest.fn();
  const onRemove = jest.fn();
  await renderWithLanguage(
    <PhotoGrid
      campingId="c1"
      photos={[{ key: 'p1', path: 'c1/old.jpg' }]}
      canEdit={canEdit}
      onAdd={onAdd}
      onRemove={onRemove}
    />,
  );
  return { upload, onAdd, onRemove };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.mocked(launchImageLibraryAsync).mockReset();
});

describe('PhotoGrid', () => {
  it('uploads a picked JPEG and reports its path', async () => {
    const { upload, onAdd } = await setup();
    picked({ uri: 'file:///DCIM/IMG_1.JPG', mimeType: 'image/jpeg', fileSize: 800_000 });
    await fireEvent.press(screen.getByTestId('photo-add'));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('c1/new.jpg'));
    expect(upload.mutate).toHaveBeenCalledWith(
      { uri: 'file:///DCIM/IMG_1.JPG', mimeType: 'image/jpeg', file: undefined },
      expect.any(Object),
    );
  });

  it('refuses unsupported formats and large files before uploading', async () => {
    const { upload } = await setup();
    picked({ uri: 'file:///IMG_2.HEIC', mimeType: 'image/heic', fileSize: 800_000 });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(await screen.findByText('Use a JPEG, PNG or WebP photo.')).toBeOnTheScreen();

    picked({ uri: 'file:///big.png', mimeType: 'image/png', fileSize: 9_000_000 });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(await screen.findByText('The photo is larger than 5 MB.')).toBeOnTheScreen();
    expect(upload.mutate).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    const { upload } = await setup();
    jest
      .mocked(launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null } as never);
    await fireEvent.press(screen.getByTestId('photo-add'));
    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalled());
    expect(upload.mutate).not.toHaveBeenCalled();
  });

  it('removes a photo', async () => {
    const { onRemove } = await setup();
    await fireEvent.press(screen.getByTestId('photo-remove-p1'));
    expect(onRemove).toHaveBeenCalledWith({ key: 'p1', path: 'c1/old.jpg' });
  });

  it('only shows photos to staff', async () => {
    await setup(false);
    expect(screen.queryByTestId('photo-add')).toBeNull();
    expect(screen.queryByTestId('photo-remove-p1')).toBeNull();
  });
});
