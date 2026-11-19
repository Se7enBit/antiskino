import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

import { invokeFunction } from './functions';

const deleteAccountSchema = z.union([
  z.object({ deleted: z.literal(true) }),
  z.object({ deleted: z.literal(false), reason: z.literal('last_owner') }),
]);

/**
 * Deletes the signed-in user's account (delete-account function): bookings
 * are anonymized, reviews removed, and the session ends on this device.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await invokeFunction('delete-account', {}, deleteAccountSchema);
      if (result.deleted) {
        // The server session is gone with the user; clear this device too.
        await getSupabase().auth.signOut({ scope: 'local' });
        queryClient.clear();
      }
      return result;
    },
  });
}
