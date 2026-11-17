import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { photoUrl } from '@/api/photos';
import { useT } from '@/i18n';
import { Icon, colors, spacing } from '@/ui';

/** Swipeable photos, one per page, with a "2 / 5" counter. */
export function Gallery({ photos }: { photos: string[] }) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  if (photos.length === 0)
    return (
      <View style={[styles.frame, styles.empty]}>
        <Icon name="tent" size={48} color={colors.muted} />
      </View>
    );
  return (
    <View style={styles.frame} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={100}
        >
          {photos.map((path, i) => (
            <Image
              key={path}
              source={{ uri: photoUrl(path) }}
              style={{ width, height: '100%' }}
              accessibilityLabel={t('camping.photo', { number: i + 1, count: photos.length })}
            />
          ))}
        </ScrollView>
      ) : null}
      {photos.length > 1 ? (
        <Text style={styles.counter}>
          {index + 1} / {photos.length}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 3 / 2,
    maxHeight: 420,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  empty: { alignItems: 'center', justifyContent: 'center' },
  counter: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: colors.onPrimary,
    fontSize: 13,
  },
});
