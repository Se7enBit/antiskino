import { authErrorKind, emailSchema, otpCodeSchema } from '../auth';

describe('emailSchema', () => {
  it('trims and lower-cases a valid address', () => {
    expect(emailSchema.parse('  Maria.P@Example.GR ')).toBe('maria.p@example.gr');
  });

  it('rejects anything that is not an email', () => {
    for (const value of ['', 'maria', 'maria@', '@example.gr', 'a b@example.gr']) {
      expect(emailSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('otpCodeSchema', () => {
  it('accepts 6 to 10 digits and ignores spaces', () => {
    expect(otpCodeSchema.parse('123456')).toBe('123456');
    expect(otpCodeSchema.parse(' 123 456 ')).toBe('123456');
    expect(otpCodeSchema.parse('1234567890')).toBe('1234567890');
  });

  it('rejects short, long or non-numeric codes', () => {
    for (const value of ['12345', '12345678901', 'abcdef', '12345a']) {
      expect(otpCodeSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('authErrorKind', () => {
  it('recognises rate limits', () => {
    expect(authErrorKind({ status: 429 })).toBe('tooManyRequests');
    expect(authErrorKind({ status: 400, code: 'over_email_send_rate_limit' })).toBe(
      'tooManyRequests',
    );
  });

  it('recognises a wrong or expired code', () => {
    expect(authErrorKind({ status: 403, code: 'otp_expired' })).toBe('wrongCode');
    expect(authErrorKind({ status: 403 })).toBe('wrongCode');
  });

  it('recognises disabled sign-ups', () => {
    expect(authErrorKind({ status: 422, code: 'signup_disabled' })).toBe('signupDisabled');
  });

  it('falls back to a generic message', () => {
    expect(authErrorKind(new Error('Network request failed'))).toBe('generic');
    expect(authErrorKind(null)).toBe('generic');
    expect(authErrorKind({ status: 500, code: 'unexpected_failure' })).toBe('generic');
  });
});
