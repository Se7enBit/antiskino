import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { colors } from '@/ui';

// Partner-member gate, sidebar/bottom tabs and camping switcher arrive in M2/M5.
export default function PartnerLayout() {
  const t = useT();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Screen name="index" options={{ title: t('partner.title') }} />
    </Stack>
  );
}
