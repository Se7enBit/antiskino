import { withSentryPlugin } from '../eas-sentry';

describe('eas-sentry pre-build step', () => {
  const appJson = {
    expo: { name: 'Antiskino', plugins: ['expo-router', ['expo-image-picker', {}]] },
  };

  it("adds Sentry's Expo plugin last, with the project and the organization when given", () => {
    expect(withSentryPlugin(appJson, { project: 'antiskino', organization: 'acme' }).expo).toEqual({
      name: 'Antiskino',
      plugins: [
        'expo-router',
        ['expo-image-picker', {}],
        ['@sentry/react-native/expo', { project: 'antiskino', organization: 'acme' }],
      ],
    });
    expect(withSentryPlugin(appJson, { project: 'antiskino' }).expo.plugins.at(-1)).toEqual([
      '@sentry/react-native/expo',
      { project: 'antiskino' },
    ]);
  });

  it('replaces an earlier Sentry entry instead of adding a second one', () => {
    const once = withSentryPlugin(appJson, { project: 'a' });
    const twice = withSentryPlugin(once, { project: 'b' });
    expect(twice.expo.plugins).toHaveLength(3);
    expect(twice.expo.plugins.at(-1)).toEqual(['@sentry/react-native/expo', { project: 'b' }]);
    expect(appJson.expo.plugins).toHaveLength(2);
  });
});
