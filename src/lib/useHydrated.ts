import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during static web rendering and while the browser hydrates that HTML,
 * true afterwards (and always on native, where nothing is pre-rendered). Use it
 * for output that differs between the server and the browser, such as icon
 * fonts, so hydration sees the same tree.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
