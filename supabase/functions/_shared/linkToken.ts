/**
 * The manage link's token, sealed for storage (bookings.manage_token_enc) so
 * that later emails can carry the link. AES-GCM with a key derived (HKDF) from
 * a secret only edge functions hold; the database keeps the SHA-256 for checks.
 * Format: "v1.<iv>.<ciphertext>", base64url.
 */
const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function keyFrom(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('antiskino'),
      info: encoder.encode('manage-link-token v1'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await keyFrom(secret),
    encoder.encode(token),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`;
}

/** The token, or null if it was sealed with another secret or is damaged. */
export async function openToken(sealed: string, secret: string): Promise<string | null> {
  const [version, iv, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !data) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(iv) },
      await keyFrom(secret),
      fromBase64Url(data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** The secret the seal key comes from: the secret key, which only edge functions have. */
export function linkSecret(): string | null {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null;
}
