import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LanguageProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="partner" />
        <Stack.Screen name="admin" />
      </Stack>
    </LanguageProvider>
  );
}
