// Native modules without a JS implementation in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must require lazily
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Maps: plain views in Jest, so screens with a map render and markers can be pressed.
jest.mock('react-native-maps', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */
  const { createElement } = require('react') as typeof import('react');
  const { Pressable, View } = require('react-native') as typeof import('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const MapView = (props: { children?: unknown; testID?: string }) =>
    createElement(View, { testID: props.testID }, props.children as never);
  const Marker = (props: { testID?: string; title?: string; onCalloutPress?: () => void }) =>
    createElement(Pressable, {
      testID: props.testID,
      accessibilityLabel: props.title,
      onPress: props.onCalloutPress,
    });
  return { __esModule: true, default: MapView, Marker };
});
