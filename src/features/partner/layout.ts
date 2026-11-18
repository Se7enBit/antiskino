import { useWindowDimensions } from 'react-native';

/** From this width the partner area shows a sidebar instead of bottom tabs. */
export const PARTNER_WIDE = 768;

export function usePartnerWide(): boolean {
  return useWindowDimensions().width >= PARTNER_WIDE;
}
