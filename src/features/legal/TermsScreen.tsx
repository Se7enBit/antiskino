import { BUSINESS } from '@/config/business';
import { useT } from '@/i18n';

import { LegalPage } from './LegalPage';

const SECTIONS = [
  'about',
  'booking',
  'prices',
  'cancellations',
  'stay',
  'reviews',
  'accounts',
  'liability',
  'law',
  'changes',
] as const;

/** /terms: the terms of use (business details from src/config/business.ts). */
export function TermsScreen() {
  const t = useT();
  return (
    <LegalPage
      title={t('legal.terms.title')}
      intro={t('legal.terms.intro')}
      sections={SECTIONS.map((id) => ({
        id,
        title: t(`legal.terms.sections.${id}.title`),
        body: t(`legal.terms.sections.${id}.body`, BUSINESS),
      }))}
      other={{ href: '/privacy', label: t('legal.privacy.title') }}
    />
  );
}
