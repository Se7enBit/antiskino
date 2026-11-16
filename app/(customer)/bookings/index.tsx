import { useT } from '@/i18n';
import { Placeholder } from '@/ui';

export default function MyBookingsScreen() {
  const t = useT();
  return <Placeholder title={t('bookings.title')} body={t('bookings.body')} />;
}
