import type { DeleteAccountResponse } from '../_shared/api.ts';
import type { Accounts } from '../_shared/accounts.ts';
import { HttpError } from '../_shared/http.ts';

/**
 * Deletes the signed-in user's account: anonymizes their bookings, removes
 * their reviews, then the login (with profile, favorites, devices, teams).
 */
export async function deleteAccount(
  authorization: string | null,
  accounts: Accounts,
): Promise<DeleteAccountResponse> {
  const userId = await accounts.userId(authorization);
  if (!userId) throw new HttpError(401, { error: 'unauthorized' });
  if ((await accounts.prepareDeletion(userId)) === 'last_owner')
    return { deleted: false, reason: 'last_owner' };
  await accounts.deleteLogin(userId);
  return { deleted: true };
}
