// App entry: native fixes, the preview builds' error alert and error reporting
// load before anything else, then Expo Router takes over.
import './src/lib/polyfills';
import './src/lib/fatalErrors';
import { initMonitoring } from './src/lib/monitoring';
import 'expo-router/entry';

initMonitoring();
