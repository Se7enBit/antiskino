import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

const urlSchema = z.url({ protocol: /^https?$/ });

/**
 * Public site URL used in links we share (invites; manage links later).
 * EXPO_PUBLIC_SITE_URL wins; on web it falls back to the current origin.
 */
export function siteUrl(): string | null {
  const fromEnv = urlSchema.safeParse(process.env.EXPO_PUBLIC_SITE_URL);
  if (fromEnv.success) return fromEnv.data.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const baseUrl = Constants.expoConfig?.experiments?.baseUrl ?? '';
    return `${window.location.origin}${baseUrl}`;
  }
  return null;
}
