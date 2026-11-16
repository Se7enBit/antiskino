import { z } from 'zod';

import { partnerRoleSchema } from './roles';

export const inviteTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** The link the admin or owner shares; it opens the accept page. */
export function inviteLink(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/invite?t=${token}`;
}

export const acceptInviteResultSchema = z.union([
  z.object({ status: z.literal('accepted'), partner_id: z.uuid() }),
  z.object({ status: z.enum(['invalid', 'used', 'expired', 'wrong_email']) }),
]);

export type AcceptInviteResult = z.infer<typeof acceptInviteResultSchema>;

export const inviteFormSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: partnerRoleSchema,
});
