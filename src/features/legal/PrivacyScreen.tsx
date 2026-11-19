import { BUSINESS } from '@/config/business';
import { useT } from '@/i18n';

import { LegalPage } from './LegalPage';

const SECTIONS = [
  'controller',
  'data',
  'purposes',
  'sharing',
  'retention',
  'rights',
  'device',
  'children',
  'changes',
] as const;

/** /privacy: the privacy policy (business details from src/config/business.ts). */
export function PrivacyScreen() {
  const t = useT();
  return (
    <LegalPage
      title={t('legal.privacy.title')}
      intro={t('legal.privacy.intro')}
      sections={SECTIONS.map((id) => ({
        id,
        title: t(`legal.privacy.sections.${id}.title`),
        body: t(`legal.privacy.sections.${id}.body`, BUSINESS),
      }))}
      other={{ href: '/terms', label: t('legal.terms.title') }}
    />
  );
}
