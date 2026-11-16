import { Stack } from 'expo-router';

import { usePartner } from '@/api/admin';
import { useT } from '@/i18n';
import { BodyText, Card, Loading, Notice, Screen } from '@/ui';

import { CampingsSection } from './CampingsSection';
import { CommissionSection } from './CommissionSection';
import { TeamSection } from './TeamSection';

export function PartnerDetail({ partnerId }: { partnerId: string | undefined }) {
  const t = useT();
  const partner = usePartner(partnerId);

  if (partnerId && partner.isPending) return <Loading label={t('common.loading')} />;
  if (partner.isError) {
    return (
      <Screen>
        <Notice tone="error" message={t('common.error')} />
      </Screen>
    );
  }
  if (!partner.data) {
    return (
      <Screen>
        <Notice message={t('admin.partner.notFound')} />
      </Screen>
    );
  }

  const p = partner.data;
  const details = [p.legal_name, p.vat_number, p.billing_email].filter(Boolean).join(' · ');
  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <Card title={p.name}>{details ? <BodyText>{details}</BodyText> : null}</Card>
      <CommissionSection partnerId={p.id} commissionBps={p.commission_bps} />
      <CampingsSection partnerId={p.id} campings={p.campings} />
      <TeamSection partnerId={p.id} partnerName={p.name} />
    </Screen>
  );
}
