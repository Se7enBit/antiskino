import { Stack } from 'expo-router';

import { useT } from '@/i18n';
import { colors } from '@/ui';

// Platform-admin gate arrives in M2.
export default function AdminLayout() {
  const t = useT();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Screen name="index" options={{ title: t('admin.title') }} />
    </Stack>
  );
}
