import { Stack } from 'expo-router';

import { useT } from '@/i18n';

// The Explore tab: Home, the results and (next) camping pages, with a back button.
export default function ExploreLayout() {
  const t = useT();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('tabs.explore') }} />
      <Stack.Screen name="search" options={{ title: t('search.results') }} />
    </Stack>
  );
}
