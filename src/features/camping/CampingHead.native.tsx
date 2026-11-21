import type { Language } from '@/i18n';

/** Native apps have no document head. See CampingHead.tsx (web). */
export function CampingHead(_props: { slug: string; pageLanguage: Language; live?: unknown }) {
  return null;
}
