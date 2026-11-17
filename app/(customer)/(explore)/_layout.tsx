import { Stack } from 'expo-router';

import { useT } from '@/i18n';

// The Explore tab: Home, the results and camping pages, with a back button.
export default function ExploreLayout() {
  const t = useT();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('tabs.explore') }} />
      <Stack.Screen name="search" options={{ title: t('search.results') }} />
      {/* The page sets its title to the camping's name once loaded. */}
      <Stack.Screen name="c/[slug]/index" options={{ title: '' }} />
      <Stack.Screen name="book" options={{ title: t('booking.title') }} />
    </Stack>
  );
}
