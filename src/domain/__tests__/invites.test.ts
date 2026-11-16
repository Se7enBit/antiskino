import { errorCode } from '../errors';
import {
  acceptInviteResultSchema,
  inviteFormSchema,
  inviteLink,
  inviteTokenSchema,
} from '../invites';

describe('invites', () => {
  const token = 'ab'.repeat(32);

  it('builds the link to the accept page', () => {
    expect(inviteLink('https://se7enbit.github.io/antiskino', token)).toBe(
      `https://se7enbit.github.io/antiskino/invite?t=${token}`,
    );
    expect(inviteLink('https://antiskino.gr/', token)).toBe(
      `https://antiskino.gr/invite?t=${token}`,
    );
  });

  it('accepts only 64-character hex tokens', () => {
    expect(inviteTokenSchema.safeParse(token).success).toBe(true);
    for (const value of ['', 'ab', token.toUpperCase(), `${token}0`, token.replace('a', 'g')]) {
      expect(inviteTokenSchema.safeParse(value).success).toBe(false);
    }
  });

  it('parses the accept result from the database', () => {
    const partnerId = '0b6f2f1e-8a51-4f3e-9b8d-2a6c1d7e9f00';
    expect(acceptInviteResultSchema.parse({ status: 'accepted', partner_id: partnerId })).toEqual({
      status: 'accepted',
      partner_id: partnerId,
    });
    expect(acceptInviteResultSchema.parse({ status: 'expired' })).toEqual({ status: 'expired' });
    expect(acceptInviteResultSchema.safeParse({ status: 'accepted' }).success).toBe(false);
    expect(acceptInviteResultSchema.safeParse({ status: 'weird' }).success).toBe(false);
  });

  it('validates the invite form', () => {
    expect(inviteFormSchema.parse({ email: ' Maria@Example.GR ', role: 'owner' })).toEqual({
      email: 'maria@example.gr',
      role: 'owner',
    });
    expect(inviteFormSchema.safeParse({ email: 'maria', role: 'owner' }).success).toBe(false);
    expect(inviteFormSchema.safeParse({ email: 'maria@example.gr', role: 'boss' }).success).toBe(
      false,
    );
  });

  it('reads Postgres error codes', () => {
    expect(errorCode({ code: '23505', message: 'duplicate key' })).toBe('23505');
    expect(errorCode(new Error('offline'))).toBeUndefined();
  });
});
