import AsyncStorage from '@react-native-async-storage/async-storage';

// iOS / Android: sessions survive app restarts in AsyncStorage.
export function authStorage() {
  return AsyncStorage;
}
