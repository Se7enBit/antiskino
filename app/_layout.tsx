import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/api/auth';
import { QueryProvider } from '@/api/QueryProvider';
import { PushSetup } from '@/features/push/PushSetup';
import { LanguageProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <PushSetup />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="partner" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="m" />
          </Stack>
        </AuthProvider>
      </QueryProvider>
    </LanguageProvider>
  );
}
