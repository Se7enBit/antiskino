import { scrubBreadcrumb, scrubEvent } from './scrub';

type BrowserSdk = typeof import('@sentry/browser');

/**
 * Web error reporting with Sentry, off unless EXPO_PUBLIC_SENTRY_DSN is set.
 * Visitors download nothing extra: small listeners wait for an error, and only
 * then is Sentry's browser SDK fetched (its own chunk) to send it. Reports carry
 * no personal details (src/lib/scrub.ts). Phones: monitoring.ts.
 */
let sdk: Promise<BrowserSdk | null> | null = null;

function load(): Promise<BrowserSdk | null> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  // Not during the static web export (Node renders the pages there).
  if (!dsn || typeof document === 'undefined') return Promise.resolve(null);
  sdk ??= import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // The listeners below report errors; Sentry's own would report them twice.
        integrations: (defaults) => defaults.filter((i) => i.name !== 'GlobalHandlers'),
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      return Sentry;
    })
    .catch(() => null);
  return sdk;
}

/** Reports an error (the crash screen, and uncaught errors on the page). */
export function reportError(error: unknown): void {
  void load().then((Sentry) => Sentry?.captureException(error));
}

/** Starts listening for uncaught errors (app entry); a no-op without a DSN. */
export function initMonitoring(): void {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN || typeof window === 'undefined') return;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
