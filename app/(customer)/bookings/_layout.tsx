import { Stack } from 'expo-router';

import { titledScreens } from '@/features/common/titledScreens';
import { useT } from '@/i18n';

const titled = titledScreens();

// The Bookings tab: the list, and a booking's details with a back button.
export default function BookingsLayout() {
  const t = useT();
  return (
    <Stack screenLayout={titled}>
      <Stack.Screen name="index" options={{ title: t('bookings.title') }} />
      <Stack.Screen name="detail" options={{ title: t('bookings.detail') }} />
    </Stack>
  );
}
