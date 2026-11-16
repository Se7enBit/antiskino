import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useMyAccess } from '@/api/access';
import { useMyCampings } from '@/api/partner';
import type { CampingStatus } from '@/domain/roles';

export type MyCamping = {
  id: string;
  name: string;
  slug: string;
  status: CampingStatus;
  partner_id: string;
};

type PartnerState = {
  isPending: boolean;
  isError: boolean;
  campings: MyCamping[];
  camping: MyCamping | null;
  selectCamping: (id: string) => void;
  /** Owners edit the camping's setup; staff only read it (and open/close nights). */
  canEdit: boolean;
};

const PartnerContext = createContext<PartnerState | null>(null);

/** The camping the partner area is showing, plus the user's role for it. */
export function PartnerProvider({ children }: { children: ReactNode }) {
  const access = useMyAccess();
  const campings = useMyCampings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const value = useMemo<PartnerState>(() => {
    const list = campings.data ?? [];
    const camping = list.find((c) => c.id === selectedId) ?? list[0] ?? null;
    const role = access.data?.memberships.find((m) => m.partnerId === camping?.partner_id)?.role;
    return {
      isPending: campings.isPending,
      isError: campings.isError,
      campings: list,
      camping,
      selectCamping: setSelectedId,
      canEdit: role === 'owner',
    };
  }, [access.data, campings.data, campings.isPending, campings.isError, selectedId]);

  return <PartnerContext value={value}>{children}</PartnerContext>;
}

export function usePartnerArea(): PartnerState {
  const state = useContext(PartnerContext);
  if (!state) throw new Error('usePartnerArea must be used inside <PartnerProvider>');
  return state;
}
