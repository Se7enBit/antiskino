import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFavoriteCampings, type FavoriteCamping } from '@/api/favorites';
import { photoUrl } from '@/api/photos';
import { regionName } from '@/domain/regions';
import { useLanguage, useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { BodyText, Button, Card, Icon, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { campingPathname } from '../camping/routes';

import { FavoriteButton } from './FavoriteButton';
import { useFavorites } from './useFavorites';

/** The Favorites tab: saved campings, newest first (SPEC F8). */
export function FavoritesScreen() {
  const t = useT();
  const hydrated = useHydrated();
  const favorites = useFavorites();
  const ready = hydrated && favorites.ready;
  const campings = useFavoriteCampings(ready ? favorites.ids : []);

  let body;
  if (!ready || (favorites.ids.length > 0 && campings.isPending))
    body = <Loading label={t('common.loading')} />;
  else if (campings.isError)
    body = (
      <>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void campings.refetch()} />
      </>
    );
  else if (!campings.data?.length)
    body = (
      <Card title={t('favorites.title')}>
        <BodyText>{t('favorites.body')}</BodyText>
      </Card>
    );
  else body = campings.data.map((camping) => <FavoriteCard key={camping.id} camping={camping} />);

  return (
    <Screen>
      {body}
      {ready && !favorites.signedIn ? <BodyText>{t('favorites.signInHint')}</BodyText> : null}
    </Screen>
  );
}

function FavoriteCard({ camping }: { camping: FavoriteCamping }) {
  const { language } = useLanguage();
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({ pathname: campingPathname(language), params: { slug: camping.slug } })
        }
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        testID={`favorite-camping-${camping.slug}`}
      >
        {camping.coverPhoto ? (
          <Image
            source={{ uri: photoUrl(camping.coverPhoto) }}
            style={styles.photo}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Icon name="tent" size={28} color={colors.muted} />
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.name}>{camping.name}</Text>
          {camping.region ? (
            <Text style={styles.muted}>{regionName(camping.region, language)}</Text>
          ) : null}
        </View>
      </Pressable>
      <FavoriteButton campingId={camping.id} name={camping.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.8 },
  photo: { width: 88, height: 66, borderRadius: 8, backgroundColor: colors.border },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
});
