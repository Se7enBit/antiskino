import { siteUrl } from '../site';

describe('siteUrl', () => {
  const saved = process.env.EXPO_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_SITE_URL = saved;
  });

  it('uses EXPO_PUBLIC_SITE_URL without a trailing slash', () => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://se7enbit.github.io/antiskino/';
    expect(siteUrl()).toBe('https://se7enbit.github.io/antiskino');
  });

  it('has no fallback on native', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(siteUrl()).toBeNull();
    process.env.EXPO_PUBLIC_SITE_URL = 'not a url';
    expect(siteUrl()).toBeNull();
  });
});
