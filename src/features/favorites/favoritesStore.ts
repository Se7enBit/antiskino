import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deviceStorage } from '@/lib/deviceStorage';

type DeviceFavorites = {
  /** Camping ids, newest first. */
  ids: string[];
  toggle: (campingId: string) => void;
  clear: () => void;
};

const storedSchema = z.object({ ids: z.array(z.uuid()).max(500) });

/** A guest's favorites, kept on the device until they sign in (SPEC F8). */
export const useDeviceFavorites = create<DeviceFavorites>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (campingId) =>
        set((state) => ({
          ids: state.ids.includes(campingId)
            ? state.ids.filter((id) => id !== campingId)
            : [campingId, ...state.ids],
        })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'antiskino-favorites',
      version: 1,
      storage: createJSONStorage(deviceStorage),
      partialize: (state) => ({ ids: state.ids }),
      // Storage is a boundary: keep only well-formed ids.
      merge: (stored, current) => ({
        ...current,
        ids: storedSchema.safeParse(stored).data?.ids ?? [],
      }),
    },
  ),
);
