import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

export function deviceStorage(): StateStorage {
  return AsyncStorage;
}
