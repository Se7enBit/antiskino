import type { ReactElement } from 'react';

import { i18n, LanguageProvider } from '@/i18n';

// react-dom has no type package here; this is the one function the test needs.
const { renderToStaticMarkup } = jest.requireActual<{
  renderToStaticMarkup: (element: ReactElement) => string;
}>('react-dom/server');

// The web head (CampingHead.tsx; Jest would pick the native stub), rendered to
// HTML like the static export does for each live camping's page (SPEC §8).
const { CampingHead } = jest.requireActual<typeof import('../CampingHead')>('../CampingHead.tsx');

jest.mock('@/api/staticCampings', () => ({
  staticCamping: (slug: string) =>
    slug === 'thalassa'
      ? {
          slug,
          name: 'Camping Thalassa',
          shortDescr: { el: 'Δίπλα στη θάλασσα', en: 'By the sea' },
          coverPhoto: 'c1/cover.jpg',
          address: 'Sarti',
          region: 'Halkidiki',
          lat: 40.09,
          lng: 23.98,
          phone: null,
          rating: { average: 4.5, count: 3 },
        }
      : undefined,
}));
jest.mock('@/api/photos', () => ({
  photoUrl: (path: string) => `https://example.supabase.co/storage/v1/object/public/photos/${path}`,
}));

const savedSiteUrl = process.env.EXPO_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.EXPO_PUBLIC_SITE_URL = 'https://example.org/antiskino';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_SITE_URL = savedSiteUrl;
});

const html = (slug: string) =>
  renderToStaticMarkup(
    <LanguageProvider>
      <CampingHead slug={slug} />
    </LanguageProvider>,
  );

describe('CampingHead (pre-rendered camping page)', () => {
  it('has the title, description and og:image of the camping', async () => {
    await i18n.changeLanguage('en');
    const head = html('thalassa');
    expect(head).toContain('<title>Camping Thalassa · Antiskino</title>');
    expect(head).toContain('<meta name="description" content="By the sea"/>');
    expect(head).toContain('<meta property="og:title" content="Camping Thalassa"/>');
    expect(head).toContain(
      '<meta property="og:url" content="https://example.org/antiskino/c/thalassa/"/>',
    );
    expect(head).toContain(
      '<meta property="og:image" content="https://example.supabase.co/storage/v1/object/public/photos/c1/cover.jpg"/>',
    );
  });

  it('carries the schema.org facts and the canonical address', async () => {
    await i18n.changeLanguage('en');
    const head = html('thalassa');
    expect(head).toContain(
      '<link rel="canonical" href="https://example.org/antiskino/c/thalassa/"/>',
    );
    const meta = /<meta name="antiskino:json-ld" content="([^"]*)"\/>/.exec(head)?.[1] ?? '';
    const ld: unknown = JSON.parse(meta.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    expect(ld).toMatchObject({
      '@type': 'Campground',
      name: 'Camping Thalassa',
      description: 'By the sea',
      url: 'https://example.org/antiskino/c/thalassa/',
      geo: { latitude: 40.09, longitude: 23.98 },
      aggregateRating: { ratingValue: 4.5, reviewCount: 3 },
    });
  });

  it('renders nothing for a camping that was not live at build time', () => {
    expect(html('unknown')).toBe('');
  });
});
