// Web (and static rendering): the browser's localStorage, absent in Node.
export function authStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
