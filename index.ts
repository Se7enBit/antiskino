// App entry: native fixes and the preview builds' error alert load before
// anything else, then Expo Router takes over.
import './src/lib/polyfills';
import './src/lib/fatalErrors';
import 'expo-router/entry';
