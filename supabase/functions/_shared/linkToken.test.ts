import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { openToken, sealToken } from './linkToken.ts';
import { newManageToken } from './token.ts';

Deno.test('seals and opens a manage token', async () => {
  const token = newManageToken();
  const sealed = await sealToken(token, 'secret-key');
  assertEquals(sealed.startsWith('v1.'), true);
  assertEquals(sealed.includes(token), false);
  assertEquals(await openToken(sealed, 'secret-key'), token);
});

Deno.test('seals differently every time', async () => {
  const token = newManageToken();
  assertNotEquals(await sealToken(token, 's'), await sealToken(token, 's'));
});

Deno.test('opens nothing with another secret or damaged data', async () => {
  const sealed = await sealToken(newManageToken(), 'secret-key');
  assertEquals(await openToken(sealed, 'other-key'), null);
  assertEquals(await openToken(sealed.slice(0, -4) + 'AAAA', 'secret-key'), null);
  assertEquals(await openToken('nonsense', 'secret-key'), null);
});
