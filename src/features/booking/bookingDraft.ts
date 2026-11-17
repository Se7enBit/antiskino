import { create } from 'zustand';

import { EMPTY_GUEST, type GuestForm } from '@/domain/booking';

type Draft = {
  /** Which stay the extras and the accepted terms belong to. */
  key: string | null;
  extras: Record<string, number>;
  /** Kept between bookings in the same visit. */
  guest: GuestForm;
  accepted: boolean;
  start: (key: string) => void;
  setExtra: (id: string, quantity: number) => void;
  setGuest: (patch: Partial<GuestForm>) => void;
  setAccepted: (accepted: boolean) => void;
  finish: () => void;
};

/** The booking in progress (SPEC §5: Zustand for the booking draft). */
export const useBookingDraft = create<Draft>()((set) => ({
  key: null,
  extras: {},
  guest: EMPTY_GUEST,
  accepted: false,
  start: (key) =>
    set((draft) => (draft.key === key ? draft : { key, extras: {}, accepted: false })),
  setExtra: (id, quantity) => set((draft) => ({ extras: { ...draft.extras, [id]: quantity } })),
  setGuest: (patch) => set((draft) => ({ guest: { ...draft.guest, ...patch } })),
  setAccepted: (accepted) => set({ accepted }),
  finish: () => set({ key: null, extras: {}, accepted: false }),
}));
