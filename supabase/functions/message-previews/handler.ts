import type { Admins } from '../_shared/admins.ts';
import type { MessagePreviewsResponse } from '../_shared/api.ts';
import { HttpError } from '../_shared/http.ts';
import { messagePreviews } from '../_shared/messagePreviews.ts';

/** Every email and push with a sample booking, for platform admins only. */
export async function previewMessages(
  authorization: string | null,
  admins: Admins,
  siteUrl: string,
): Promise<MessagePreviewsResponse> {
  if (!(await admins.isAdmin(authorization))) throw new HttpError(401, { error: 'unauthorized' });
  return { previews: messagePreviews(siteUrl) };
}
