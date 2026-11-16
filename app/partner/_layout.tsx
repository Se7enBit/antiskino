import { Stack } from 'expo-router';

import { RequireAccess } from '@/features/auth/RequireAccess';
import { useT } from '@/i18n';
import { colors } from '@/ui';

// Partner members only. Sidebar/bottom tabs and the camping switcher arrive with the partner screens.
export default function PartnerLayout() {
  const t = useT();
  return (
    <RequireAccess area="partner">
      <Stack screenOptions={{ headerTintColor: colors.primary }}>
        <Stack.Screen name="index" options={{ title: t('partner.title') }} />
      </Stack>
    </RequireAccess>
  );
}
