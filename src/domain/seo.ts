/** A pre-rendered camping page's facts for search engines (schema.org Campground). */
export type CampgroundFacts = {
  name: string;
  description: string;
  url: string | null;
  image: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  /** Shown only from 3 visible reviews, like on the page (SPEC F9). */
  rating: { average: number; count: number } | null;
};

/** Reviews needed before a rating is shown. */
export const MIN_REVIEWS_FOR_RATING = 3;

/** schema.org JSON-LD for one camping; empty fields are left out. */
export function campgroundJsonLd(c: CampgroundFacts): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Campground',
    name: c.name,
  };
  if (c.description) ld.description = c.description;
  if (c.url) ld.url = c.url;
  if (c.image) ld.image = c.image;
  if (c.phone) ld.telephone = c.phone;
  if (c.address || c.region) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(c.address ? { streetAddress: c.address } : {}),
      ...(c.region ? { addressRegion: c.region } : {}),
      addressCountry: 'GR',
    };
  }
  if (c.lat !== null && c.lng !== null) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng };
  }
  if (c.rating && c.rating.count >= MIN_REVIEWS_FOR_RATING) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: c.rating.average,
      reviewCount: c.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}
