import { useMergeDeviceFavorites } from './useFavorites';

/** Moves a guest's favorites into their account when they sign in. */
export function FavoritesSync() {
  useMergeDeviceFavorites();
  return null;
}
