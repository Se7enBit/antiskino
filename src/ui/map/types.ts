import type { Pin } from '@/domain/map';

export type PinsMapProps = {
  pins: Pin[];
  /** Tapping a pin (web) or its callout (native). */
  onPress?: (id: string) => void;
  height: number;
};
