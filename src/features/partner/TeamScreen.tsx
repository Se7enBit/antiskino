import { useAuth } from '@/api/auth';
import { useT } from '@/i18n';
import { Notice } from '@/ui';

import { TeamManager } from '../team/TeamManager';

import { PartnerScreen } from './PartnerScreen';

/** /partner/team: owners invite staff and manage the team (SPEC F11 Team). */
export function TeamScreen() {
  const t = useT();
  const { session } = useAuth();
  return (
    <PartnerScreen>
      {({ camping, canEdit }) =>
        canEdit ? (
          <TeamManager
            // The team belongs to the partner, not to one camping.
            partnerId={camping.partner_id}
            partnerName={camping.name}
            defaultRole="staff"
            selfId={session?.user.id}
          />
        ) : (
          <Notice message={t('partner.team.ownersOnly')} />
        )
      }
    </PartnerScreen>
  );
}
