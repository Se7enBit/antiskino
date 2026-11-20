import { Platform } from 'react-native';

import { scrubBreadcrumb, scrubEvent } from './scrub';

type SentrySdk = typeof import('@sentry/react-native');

/**
 * Crash and error reporting with Sentry, off unless EXPO_PUBLIC_SENTRY_DSN is
 * set. The SDK then loads on its own (a separate chunk on the web, nothing
 * downloaded otherwise). Reports carry no personal details (src/lib/scrub.ts),
 * no performance traces and no screenshots.
 */
let sdk: Promise<SentrySdk | null> | null = null;

function load(): Promise<SentrySdk | null> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  // Not during the static web export (Node renders the pages there).
  if (!dsn || (Platform.OS === 'web' && typeof document === 'undefined')) {
    return Promise.resolve(null);
  }
  sdk ??= import('@sentry/react-native')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        attachScreenshot: false,
        attachViewHierarchy: false,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      return Sentry;
    })
    .catch(() => null);
  return sdk;
}

/** Starts reporting (app entry); a no-op without a DSN. */
export function initMonitoring(): void {
  void load();
}

/** Reports an error caught by the app (the crash screen), once Sentry is loaded. */
export function reportError(error: unknown): void {
  void load().then((Sentry) => Sentry?.captureException(error));
}
