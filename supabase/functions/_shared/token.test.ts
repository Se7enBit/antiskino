import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1';

import { newManageToken, sha256Hex } from './token.ts';

Deno.test('tokens are 32 random bytes in base64url', () => {
  const token = newManageToken();
  assertMatch(token, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(token, newManageToken());
});

Deno.test('hashes like SQL sha256_hex()', async () => {
  // select encode(sha256(convert_to('token', 'UTF8')), 'hex')
  assertEquals(
    await sha256Hex('token'),
    '3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0',
  );
});
