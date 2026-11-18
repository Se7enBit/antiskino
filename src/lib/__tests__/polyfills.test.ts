/**
 * React Native's URL has getters but no `protocol` setter, and supabase-js sets
 * it when it creates a client: the Android preview APK closed on start. The
 * polyfill (polyfills.native.ts, loaded first by index.ts) replaces URL.
 */
const NodeURL = globalThis.URL;

/** Like React Native 0.88's URL: read-only `protocol`. */
class ReadOnlyProtocolURL {
  private readonly url: InstanceType<typeof NodeURL>;
  constructor(url: string, base?: string | ReadOnlyProtocolURL) {
    this.url = new NodeURL(url, base === undefined ? undefined : String(base));
  }
  get protocol() {
    return this.url.protocol;
  }
  get href() {
    return this.url.href;
  }
  toString() {
    return this.url.href;
  }
}

afterEach(() => {
  globalThis.URL = NodeURL;
  jest.resetModules();
});

const create = () =>
  jest.isolateModules(() => {
    type Supabase = typeof import('@supabase/supabase-js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after URL is swapped
    const { createClient } = require('@supabase/supabase-js') as Supabase;
    createClient('https://example.supabase.co', 'publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

describe('URL polyfill', () => {
  it('is what supabase-js needs on React Native', () => {
    globalThis.URL = ReadOnlyProtocolURL as unknown as typeof URL;
    expect(create).toThrow(TypeError);
  });

  it('lets the client be created', () => {
    globalThis.URL = ReadOnlyProtocolURL as unknown as typeof URL;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the native entry's first import
      require('../polyfills.native');
    });
    expect(create).not.toThrow();
  });
});
