import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';

import { useT } from '@/i18n';
import { Icon, colors, phoneTabBarStyle, tabLabelStyle, type IconName } from '@/ui';

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} color={typeof color === 'string' ? color : colors.muted} size={22} />;
}

export default function CustomerLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: tabLabelStyle(12),
        tabBarStyle: phoneTabBarStyle,
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tabs.Screen
        name="(explore)"
        options={{
          title: t('tabs.explore'),
          // The Explore stack shows its own headers (with a back button on results).
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="magnify" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabs.favorites'),
          tabBarIcon: ({ color }) => <TabIcon name="heart-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('tabs.bookings'),
          // The Bookings stack shows its own headers (with a back button on details).
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="calendar-check-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ color }) => <TabIcon name="account-circle-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
