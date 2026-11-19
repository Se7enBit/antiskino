import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/api/auth';
import { QueryProvider } from '@/api/QueryProvider';
import { CrashScreen } from '@/features/common/CrashScreen';
import { FavoritesSync } from '@/features/favorites/FavoritesSync';
import { PushSetup } from '@/features/push/PushSetup';
import { LanguageProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <PushSetup />
          <FavoritesSync />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="partner" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="m" />
            <Stack.Screen name="delete-account" />
          </Stack>
        </AuthProvider>
      </QueryProvider>
    </LanguageProvider>
  );
}

// An unexpected error anywhere shows a way back instead of a blank page. It
// replaces the layout, so it brings its own language provider.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <LanguageProvider>
      <CrashScreen onRetry={() => void retry()} />
    </LanguageProvider>
  );
}
