import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { PartnerDetail } from '@/features/admin/PartnerDetail';

// /admin/partner?id=<uuid>: a query parameter instead of /admin/partners/[id],
// because static web hosting cannot pre-render unknown ids.
export default function PartnerScreen() {
  const { id } = useLocalSearchParams();
  const partnerId = z.uuid().safeParse(id);
  return <PartnerDetail partnerId={partnerId.success ? partnerId.data : undefined} />;
}
