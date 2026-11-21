import { useLocalSearchParams } from 'expo-router';

import { usePartnerBooking } from '@/api/partnerBookings';
import { useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { BodyText, Button, Loading, Notice, Screen } from '@/ui';

import { BookingDetail } from '../partner/BookingDetailScreen';

import { GuestEditForm } from './GuestEditForm';

/**
 * /admin/booking?ref=ANT-…: any camping's booking, with what its team can do
 * (cancel with a reason included) and the guest's details to correct (SPEC F12).
 */
export function AdminBookingScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  // The static page is built without URL parameters.
  const hydrated = useHydrated();
  const ref = hydrated && typeof params.ref === 'string' ? params.ref : undefined;
  const booking = usePartnerBooking(ref);

  let body;
  if (!hydrated || (ref && booking.isPending)) body = <Loading label={t('common.loading')} />;
  else if (booking.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void booking.refetch()} />
      </>
    );
  else if (!booking.data) body = <Notice message={t('partner.booking.notFound')} />;
  else
    body = (
      <>
        <BodyText>{t('admin.booking.actingAs')}</BodyText>
        <BookingDetail
          booking={booking.data}
          guestExtra={<GuestEditForm key={booking.data.id} booking={booking.data} />}
        />
      </>
    );
  return <Screen>{body}</Screen>;
}
