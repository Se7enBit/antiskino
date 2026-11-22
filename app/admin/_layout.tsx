import { Stack } from 'expo-router';

import { RequireAccess } from '@/features/auth/RequireAccess';
import { titledScreens } from '@/features/common/titledScreens';
import { useT } from '@/i18n';
import { colors } from '@/ui';

const titled = titledScreens();

// Platform admins only.
export default function AdminLayout() {
  const t = useT();
  return (
    <RequireAccess area="admin">
      <Stack screenLayout={titled} screenOptions={{ headerTintColor: colors.primary }}>
        <Stack.Screen name="index" options={{ title: t('admin.title') }} />
        <Stack.Screen name="new-partner" options={{ title: t('admin.partnerForm.title') }} />
        <Stack.Screen name="partner" options={{ title: t('admin.partner.title') }} />
        <Stack.Screen name="bookings" options={{ title: t('admin.bookings.title') }} />
        <Stack.Screen name="booking" options={{ title: t('admin.booking.title') }} />
        <Stack.Screen name="commission" options={{ title: t('admin.commission.title') }} />
        <Stack.Screen name="reviews" options={{ title: t('admin.reviews.title') }} />
        <Stack.Screen name="messages" options={{ title: t('admin.messages.title') }} />
      </Stack>
    </RequireAccess>
  );
}
