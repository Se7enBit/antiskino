// Native modules without a JS implementation in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must require lazily
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
