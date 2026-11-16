import { z } from 'zod';

/** Email typed into the sign-in form; stored lower-case. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** One-time code from the sign-in email (6 digits by default; projects can use up to 10). */
export const otpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6,10}$/));

export type AuthErrorKind = 'tooManyRequests' | 'wrongCode' | 'signupDisabled' | 'generic';

const authErrorShape = z.object({
  status: z.number().optional(),
  code: z.string().optional(),
});

/** Maps a Supabase Auth error to the message the user sees. */
export function authErrorKind(error: unknown): AuthErrorKind {
  const parsed = authErrorShape.safeParse(error);
  if (!parsed.success) return 'generic';
  const { status, code } = parsed.data;
  if (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit'
  ) {
    return 'tooManyRequests';
  }
  if (
    code === 'otp_expired' ||
    code === 'invalid_credentials' ||
    (status === 403 && code === undefined)
  ) {
    return 'wrongCode';
  }
  if (code === 'signup_disabled' || code === 'otp_disabled') return 'signupDisabled';
  return 'generic';
}
