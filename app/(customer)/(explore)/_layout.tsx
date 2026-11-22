import { Stack } from 'expo-router';

import { titledScreens } from '@/features/common/titledScreens';
import { useT } from '@/i18n';

// Home and the camping pages set their own head (PageHead, CampingHead).
const titled = titledScreens(['index']);

// The Explore tab: Home, the results and camping pages, with a back button.
export default function ExploreLayout() {
  const t = useT();
  return (
    <Stack screenLayout={titled}>
      <Stack.Screen name="index" options={{ title: t('tabs.explore') }} />
      <Stack.Screen name="search" options={{ title: t('search.results') }} />
      {/* The page sets its title to the camping's name once loaded. */}
      <Stack.Screen name="c/[slug]/index" options={{ title: '' }} />
      <Stack.Screen name="en/c/[slug]/index" options={{ title: '' }} />
      <Stack.Screen name="book" options={{ title: t('booking.title') }} />
    </Stack>
  );
}
