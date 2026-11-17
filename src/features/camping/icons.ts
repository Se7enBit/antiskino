import type { Amenity } from '@/domain/amenities';
import type { Equipment } from '@/domain/search';
import type { IconName } from '@/ui';

export const EQUIPMENT_ICONS: Record<Equipment, IconName> = {
  tent: 'tent',
  caravan: 'caravan',
  camper: 'rv-truck',
};

export const AMENITY_ICONS: Record<Amenity, IconName> = {
  hot_showers: 'shower',
  electricity: 'flash',
  wifi: 'wifi',
  beach_access: 'beach',
  pool: 'pool',
  restaurant: 'silverware-fork-knife',
  bar: 'glass-cocktail',
  mini_market: 'store',
  laundry: 'washing-machine',
  shared_kitchen: 'stove',
  bbq: 'grill',
  pets_allowed: 'paw',
  playground: 'seesaw',
  shade: 'pine-tree',
};
