// React Native's URL lacks setters such as `protocol`, which supabase-js uses
// when it creates its client (realtime URL): without this the app closes on
// start in Android and iOS builds. The browser's URL needs nothing (polyfills.ts).
import 'react-native-url-polyfill/auto';
