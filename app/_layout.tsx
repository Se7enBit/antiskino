// First: zod settings before any schema runs.
import '@/lib/zodConfig';

import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/api/auth';
import { QueryProvider } from '@/api/QueryProvider';
import { CrashScreen } from '@/features/common/CrashScreen';
import { FavoritesSync } from '@/features/favorites/FavoritesSync';
import { PushSetup } from '@/features/push/PushSetup';
import { LanguageProvider, languageOfPath } from '@/i18n';

export default function RootLayout() {
  // Camping pages on the web take their language from the address.
  const pathname = usePathname();
  return (
    <LanguageProvider urlLanguage={languageOfPath(pathname)}>
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
            <Stack.Screen name="terms" />
            <Stack.Screen name="privacy" />
          </Stack>
        </AuthProvider>
      </QueryProvider>
    </LanguageProvider>
  );
}

// An unexpected error anywhere shows a way back instead of a blank page. It
// replaces the layout, so it brings its own language provider.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <LanguageProvider>
      <CrashScreen error={error} onRetry={() => void retry()} />
    </LanguageProvider>
  );
}
