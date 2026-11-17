import { create } from 'zustand';

import { DEFAULT_QUERY, type SearchQuery } from '@/domain/search';

type SearchState = {
  query: SearchQuery;
  update: (patch: Partial<SearchQuery>) => void;
};

/** The search form, shared by Home, the results and (later) the camping page. */
export const useSearchStore = create<SearchState>()((set) => ({
  query: DEFAULT_QUERY,
  update: (patch) => set((state) => ({ query: { ...state.query, ...patch } })),
}));
