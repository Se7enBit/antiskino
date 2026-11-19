import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import type { Accounts } from '../_shared/accounts.ts';
import { HttpError } from '../_shared/http.ts';
import { deleteAccount } from './handler.ts';

function fakeAccounts(prepared: 'ok' | 'last_owner' = 'ok') {
  const calls: string[] = [];
  const accounts: Accounts = {
    userId: (authorization) =>
      Promise.resolve(authorization === 'Bearer user-jwt' ? 'user-1' : null),
    prepareDeletion: (userId) => {
      calls.push(`prepare ${userId}`);
      return Promise.resolve(prepared);
    },
    deleteLogin: (userId) => {
      calls.push(`delete ${userId}`);
      return Promise.resolve();
    },
  };
  return { accounts, calls };
}

Deno.test('anonymizes, then deletes the login', async () => {
  const { accounts, calls } = fakeAccounts();
  assertEquals(await deleteAccount('Bearer user-jwt', accounts), { deleted: true });
  assertEquals(calls, ['prepare user-1', 'delete user-1']);
});

Deno.test('keeps the last owner of a partner', async () => {
  const { accounts, calls } = fakeAccounts('last_owner');
  assertEquals(await deleteAccount('Bearer user-jwt', accounts), {
    deleted: false,
    reason: 'last_owner',
  });
  assertEquals(calls, ['prepare user-1']);
});

Deno.test('needs a signed-in user', async () => {
  const { accounts, calls } = fakeAccounts();
  await assertRejects(() => deleteAccount('Bearer publishable-key', accounts), HttpError);
  await assertRejects(() => deleteAccount(null, accounts), HttpError);
  assertEquals(calls, []);
});
