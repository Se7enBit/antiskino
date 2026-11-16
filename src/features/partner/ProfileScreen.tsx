import { useCamping } from '@/api/partner';
import { useT } from '@/i18n';
import { Loading, Notice } from '@/ui';

import { CampingProfileForm } from './CampingProfileForm';
import { PartnerScreen } from './PartnerScreen';

export function ProfileScreen() {
  return (
    <PartnerScreen>
      {({ camping, canEdit }) => <ProfileBody id={camping.id} canEdit={canEdit} />}
    </PartnerScreen>
  );
}

function ProfileBody({ id, canEdit }: { id: string; canEdit: boolean }) {
  const t = useT();
  const camping = useCamping(id);
  if (camping.isPending) return <Loading label={t('common.loading')} />;
  if (!camping.data) return <Notice tone="error" message={t('common.error')} />;
  // key: switching campings starts a fresh form
  return <CampingProfileForm key={camping.data.id} camping={camping.data} canEdit={canEdit} />;
}
