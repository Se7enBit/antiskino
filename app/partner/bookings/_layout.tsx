import { Stack } from 'expo-router';

import { titledScreens } from '@/features/common/titledScreens';
import { HeaderLinks } from '@/features/partner/HeaderLinks';
import { useT } from '@/i18n';
import { colors } from '@/ui';

const titled = titledScreens();

// The Bookings tab: the list, and a booking's details with a back button.
export default function PartnerBookingsLayout() {
  const t = useT();
  return (
    <Stack
      screenLayout={titled}
      screenOptions={{ headerTintColor: colors.primary, headerRight: () => <HeaderLinks /> }}
    >
      <Stack.Screen name="index" options={{ title: t('partner.nav.bookings') }} />
      <Stack.Screen name="detail" options={{ title: t('partner.booking.title') }} />
    </Stack>
  );
}
