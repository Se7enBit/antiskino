import { Stack } from 'expo-router';

import { RequireAccess } from '@/features/auth/RequireAccess';
import { useT } from '@/i18n';
import { colors } from '@/ui';

// Platform admins only.
export default function AdminLayout() {
  const t = useT();
  return (
    <RequireAccess area="admin">
      <Stack screenOptions={{ headerTintColor: colors.primary }}>
        <Stack.Screen name="index" options={{ title: t('admin.title') }} />
      </Stack>
    </RequireAccess>
  );
}
