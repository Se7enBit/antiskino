import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import type { MessagePreviewsResponse } from '../../supabase/functions/_shared/api';

import { invokeFunction } from './functions';

const schema: z.ZodType<MessagePreviewsResponse> = z.object({
  previews: z.array(
    z.object({
      kind: z.string(),
      audience: z.enum(['guest', 'partner']),
      locale: z.enum(['el', 'en']),
      email: z.object({ subject: z.string(), text: z.string(), html: z.string() }).nullable(),
      push: z.object({ title: z.string(), body: z.string() }).nullable(),
    }),
  ),
});

/** Every email and push with a sample booking (admins; the message-previews function). */
export function useMessagePreviews() {
  return useQuery({
    queryKey: ['admin', 'messagePreviews'],
    queryFn: () => invokeFunction('message-previews', {}, schema),
    staleTime: Infinity,
  });
}
