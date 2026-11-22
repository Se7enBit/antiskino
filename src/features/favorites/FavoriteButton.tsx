import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { Icon, colors } from '@/ui';

import { useFavorites } from './useFavorites';

/** The heart that saves a camping (SPEC F8). */
export function FavoriteButton({ campingId, name }: { campingId: string; name: string }) {
  const t = useT();
  // Device favorites load in the browser: the static page shows an empty spot.
  const hydrated = useHydrated();
  const favorites = useFavorites();
  if (!hydrated) return <View style={styles.button} />;
  const saved = favorites.isFavorite(campingId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      aria-pressed={saved}
      accessibilityLabel={saved ? t('favorites.remove', { name }) : t('favorites.add', { name })}
      onPress={() => favorites.toggle(campingId)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={`favorite-${campingId}`}
    >
      <Icon
        name={saved ? 'heart' : 'heart-outline'}
        size={24}
        color={saved ? colors.danger : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.7 },
});
