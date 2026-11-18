import type { StateStorage } from 'zustand/middleware';

/** Static rendering has no storage: nothing is read or kept. */
const NOWHERE: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * Key-value storage on this device for small app state (guest favorites):
 * the browser's localStorage. deviceStorage.native.ts uses AsyncStorage.
 */
export function deviceStorage(): StateStorage {
  if (typeof window === 'undefined') return NOWHERE;
  try {
    return window.localStorage;
  } catch {
    return NOWHERE;
  }
}
