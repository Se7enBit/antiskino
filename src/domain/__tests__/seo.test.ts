import { campgroundJsonLd, type CampgroundFacts } from '../seo';

const facts: CampgroundFacts = {
  name: 'Camping Thalassa',
  description: 'Shady pitches by the sea.',
  url: 'https://example.org/c/thalassa',
  image: 'https://example.org/photo.jpg',
  phone: '+30 2375 000000',
  address: 'Sarti, Sithonia',
  region: 'Halkidiki',
  lat: 40.09,
  lng: 23.98,
  rating: { average: 4.6, count: 12 },
};

describe('campgroundJsonLd', () => {
  it('describes the camping for search engines', () => {
    expect(campgroundJsonLd(facts)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Campground',
      name: 'Camping Thalassa',
      description: 'Shady pitches by the sea.',
      url: 'https://example.org/c/thalassa',
      image: 'https://example.org/photo.jpg',
      telephone: '+30 2375 000000',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Sarti, Sithonia',
        addressRegion: 'Halkidiki',
        addressCountry: 'GR',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 40.09, longitude: 23.98 },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.6,
        reviewCount: 12,
        bestRating: 5,
        worstRating: 1,
      },
    });
  });

  it('leaves out what the camping has not filled in, and ratings under 3 reviews', () => {
    expect(
      campgroundJsonLd({
        ...facts,
        description: '',
        url: null,
        image: null,
        phone: null,
        address: null,
        region: null,
        lat: null,
        lng: 23.98,
        rating: { average: 5, count: 2 },
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Campground',
      name: 'Camping Thalassa',
    });
  });
});
