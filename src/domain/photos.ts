/** Same limits as the photos bucket (see the photos_storage migration). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

export type PhotoMimeType = keyof typeof EXTENSIONS;

export type PhotoProblem = 'type' | 'size';

/** The MIME type of a picked image, from its reported type or its file name. */
export function photoMimeType(mimeType: string | null | undefined, uri: string): string {
  if (mimeType) return mimeType.toLowerCase();
  const extension = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

/** Why a picked image can't be uploaded, or null when it can. */
export function photoProblem(mimeType: string, size: number | undefined): PhotoProblem | null {
  if (!(mimeType in EXTENSIONS)) return 'type';
  if (size !== undefined && size > PHOTO_MAX_BYTES) return 'size';
  return null;
}

/** Storage path for a new photo of a camping: `<camping_id>/<unique>.<ext>`. */
export function newPhotoPath(campingId: string, mimeType: PhotoMimeType, now = Date.now()): string {
  const unique = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${campingId}/${unique}.${EXTENSIONS[mimeType]}`;
}

export function isPhotoMimeType(mimeType: string): mimeType is PhotoMimeType {
  return mimeType in EXTENSIONS;
}
