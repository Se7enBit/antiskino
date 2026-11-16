import { useT } from '@/i18n';
import { Placeholder } from '@/ui';

// Home: search, or the single live camping (M3).
export default function ExploreScreen() {
  const t = useT();
  return <Placeholder title={t('explore.title')} body={t('explore.body')} />;
}
