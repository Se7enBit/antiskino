import { useT } from '@/i18n';
import { Card } from '@/ui';

import { TeamManager } from '../team/TeamManager';

/** The partner page's team (SPEC F12): the admin invites the owner, then manages the team like one. */
export function TeamSection({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const t = useT();
  return (
    <Card title={t('admin.team.title')}>
      <TeamManager partnerId={partnerId} partnerName={partnerName} defaultRole="owner" />
    </Card>
  );
}
