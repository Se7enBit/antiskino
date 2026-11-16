import { z } from 'zod';

export const PARTNER_ROLES = ['owner', 'staff'] as const;
export const partnerRoleSchema = z.enum(PARTNER_ROLES);
export type PartnerRole = z.infer<typeof partnerRoleSchema>;

export const CAMPING_STATUSES = ['draft', 'live', 'paused'] as const;
export type CampingStatus = (typeof CAMPING_STATUSES)[number];
