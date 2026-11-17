import { PHOTO_MAX_BYTES, newPhotoPath, photoMimeType, photoProblem } from '../photos';

describe('photos', () => {
  it('works out the MIME type from the picker or the file name', () => {
    expect(photoMimeType('image/JPEG', 'file:///a.png')).toBe('image/jpeg');
    expect(photoMimeType(undefined, 'file:///x/IMG_1.JPG')).toBe('image/jpeg');
    expect(photoMimeType(null, 'blob:https://x/abc.webp?v=1')).toBe('image/webp');
    expect(photoMimeType(undefined, 'file:///x/clip.mov')).toBe('application/octet-stream');
  });

  it('accepts JPEG, PNG and WebP up to 5 MB', () => {
    expect(photoProblem('image/jpeg', 1000)).toBeNull();
    expect(photoProblem('image/png', undefined)).toBeNull();
    expect(photoProblem('image/heic', 1000)).toBe('type');
    expect(photoProblem('image/webp', PHOTO_MAX_BYTES + 1)).toBe('size');
  });

  it('stores photos in the camping folder with a unique name', () => {
    const path = newPhotoPath(
      'a0000000-0000-4000-8000-0000000000a1',
      'image/png',
      1_700_000_000_000,
    );
    expect(path).toMatch(/^a0000000-0000-4000-8000-0000000000a1\/[a-z0-9]+-[a-z0-9]+\.png$/);
    expect(newPhotoPath('c1', 'image/jpeg')).not.toBe(newPhotoPath('c1', 'image/jpeg'));
  });
});
