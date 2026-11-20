import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

// What error reports may carry (SPEC §0 Crash reporting): no query strings
// (manage-link and invite tokens, search filters), no email addresses, no user.

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** A URL without its query string and fragment. */
export function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/s, '');
}

/** Text with email addresses masked and URLs cut before their query strings. */
export function scrubText(text: string): string {
  return text.replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1').replace(EMAIL, '[email]');
}

const scrubValue = (value: unknown): unknown =>
  typeof value === 'string' ? scrubText(value) : value;

/** Sentry's beforeSend: the event without personal details. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  return event;
}

/** Sentry's beforeBreadcrumb: navigation and request crumbs keep paths only. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const data = crumb.data
    ? Object.fromEntries(
        Object.entries(crumb.data).map(([key, value]) =>
          ['url', 'from', 'to'].includes(key) && typeof value === 'string'
            ? [key, scrubUrl(value)]
            : [key, scrubValue(value)],
        ),
      )
    : undefined;
  return {
    ...crumb,
    ...(crumb.message ? { message: scrubText(crumb.message) } : {}),
    ...(data ? { data } : {}),
  };
}
