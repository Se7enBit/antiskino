/** The fixed amenity list (SPEC F2). Labels live in the locale files under amenities.*. */
export const AMENITIES = [
  'hot_showers',
  'electricity',
  'wifi',
  'beach_access',
  'pool',
  'restaurant',
  'bar',
  'mini_market',
  'laundry',
  'shared_kitchen',
  'bbq',
  'pets_allowed',
  'playground',
  'shade',
] as const;

export type Amenity = (typeof AMENITIES)[number];

export function isAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value);
}
