import { useT } from '@/i18n';
import { Notice } from '@/ui';

import { PartnerScreen } from './PartnerScreen';

/** Placeholder for partner screens still being built in M2. */
export function ComingSoon() {
  const t = useT();
  return <PartnerScreen>{() => <Notice message={t('partner.comingSoon')} />}</PartnerScreen>;
}
