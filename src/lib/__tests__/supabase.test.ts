import { createSupabaseClient, getSupabase, isSecretKey, parseSupabaseEnv } from '../supabase';

const valid = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_test_key',
};

describe('parseSupabaseEnv', () => {
  it('accepts a URL and a publishable key', () => {
    expect(parseSupabaseEnv(valid)).toEqual({
      url: 'https://abcdefghijklmnop.supabase.co',
      key: 'sb_publishable_test_key',
    });
  });

  it('accepts the local stack URL', () => {
    expect(
      parseSupabaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).url,
    ).toBe('http://127.0.0.1:54321');
  });

  it('names every missing variable', () => {
    expect(() => parseSupabaseEnv({})).toThrow(
      'Missing or invalid EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY',
    );
    expect(() => parseSupabaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_KEY: '  ' })).toThrow(
      'Missing or invalid EXPO_PUBLIC_SUPABASE_KEY.',
    );
  });

  it('rejects a non-http URL without echoing secrets', () => {
    const run = () =>
      parseSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'ftp://secret-host',
        EXPO_PUBLIC_SUPABASE_KEY: 'sb_secret_xyz',
      });
    expect(run).toThrow('EXPO_PUBLIC_SUPABASE_URL');
    expect(run).not.toThrow(/secret-host|sb_secret_xyz/);
  });
});

describe('secret keys', () => {
  const jwt = (role: string) =>
    ['eyJhbGciOiJIUzI1NiJ9', btoa(JSON.stringify({ role })).replace(/=+$/, ''), 'sig'].join('.');

  it('refuses the secret key in the public settings, without echoing it', () => {
    for (const key of ['sb_secret_abc123', jwt('service_role')]) {
      const run = () => parseSupabaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_KEY: key });
      expect(run).toThrow('Missing or invalid EXPO_PUBLIC_SUPABASE_KEY.');
      expect(run).not.toThrow(key);
    }
  });

  it('accepts publishable and anon keys', () => {
    expect(isSecretKey('sb_publishable_abc123')).toBe(false);
    expect(isSecretKey(jwt('anon'))).toBe(false);
    expect(isSecretKey('not.a-jwt.at-all')).toBe(false);
  });
});

describe('createSupabaseClient', () => {
  it('builds a typed client for the given project', () => {
    const client = createSupabaseClient(parseSupabaseEnv(valid));
    expect(typeof client.from).toBe('function');
    expect(typeof client.rpc).toBe('function');
    expect(typeof client.auth.signInWithOtp).toBe('function');
  });
});

describe('getSupabase', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('fails with a clear message when the env is not set', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    expect(() => getSupabase()).toThrow(/EXPO_PUBLIC_SUPABASE_URL.*\.env\.example/);
  });

  it('creates the client once from the env', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = valid.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_KEY = valid.EXPO_PUBLIC_SUPABASE_KEY;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../supabase') as typeof import('../supabase');
      expect(fresh.getSupabase()).toBe(fresh.getSupabase());
    });
  });
});
