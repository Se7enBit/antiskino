import type { ErrorEvent } from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from '../scrub';

describe('scrubbing error reports', () => {
  it('drops query strings, where manage and invite tokens live', () => {
    expect(scrubUrl('https://antiskino.gr/m?ref=ANT-7K3P9Q&t=secret#x')).toBe(
      'https://antiskino.gr/m',
    );
    expect(scrubUrl('/invite?t=secret')).toBe('/invite');
  });

  it('masks email addresses and URL queries in text', () => {
    expect(
      scrubText(
        'Failed for maria.p@example.gr at https://x.supabase.co/rest/v1/b?guest_email=eq.a@b.gr',
      ),
    ).toBe('Failed for [email] at https://x.supabase.co/rest/v1/b');
  });

  it('removes the user and request details from events', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'maria@example.gr' },
      message: 'Booking for maria@example.gr failed',
      request: {
        url: 'https://antiskino.gr/m?ref=A&t=secret',
        query_string: 'ref=A&t=secret',
        headers: { Authorization: 'Bearer jwt' },
        data: { email: 'maria@example.gr' },
      },
      exception: { values: [{ type: 'Error', value: 'No booking for maria@example.gr' }] },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/m?ref=A&t=secret', to: '/bookings' } },
      ],
    } as ErrorEvent);
    expect(event.user).toBeUndefined();
    expect(event.message).toBe('Booking for [email] failed');
    expect(event.request).toEqual({ url: 'https://antiskino.gr/m' });
    expect(event.exception?.values?.[0]?.value).toBe('No booking for [email]');
    expect(event.breadcrumbs?.[0]?.data).toEqual({ from: '/m', to: '/bookings' });
  });

  it('keeps request breadcrumbs to their path', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: { url: 'https://x.supabase.co/rest/v1/bookings?ref=eq.ANT-1', method: 'GET' },
      }),
    ).toEqual({
      category: 'fetch',
      data: { url: 'https://x.supabase.co/rest/v1/bookings', method: 'GET' },
    });
  });
});
