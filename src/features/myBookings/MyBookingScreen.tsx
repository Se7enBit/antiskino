import { useLocalSearchParams } from 'expo-router';

import { useCancelMyBooking, useMyBooking } from '@/api/myBookings';
import { useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { Button, Loading, Notice, Screen } from '@/ui';

import { BookingDetails } from '../manage/BookingDetails';

/** /bookings/detail?ref=ANT-…: one of the signed-in guest's bookings. */
export function MyBookingScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  // The static page is built without URL parameters.
  const hydrated = useHydrated();
  const ref = hydrated && typeof params.ref === 'string' ? params.ref : undefined;
  const booking = useMyBooking(ref);
  const cancel = useCancelMyBooking();

  let body;
  if (!hydrated || (ref && booking.isPending)) body = <Loading label={t('common.loading')} />;
  else if (booking.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void booking.refetch()} />
      </>
    );
  else if (!booking.data) body = <Notice message={t('manage.notFound')} />;
  else {
    const { id } = booking.data;
    body = (
      <BookingDetails
        booking={booking.data}
        onCancel={() => cancel.mutate(id)}
        cancelling={cancel.isPending}
        cancelFailed={cancel.isError}
      />
    );
  }
  return <Screen>{body}</Screen>;
}
