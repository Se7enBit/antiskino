import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';

import { useCampingBookingsLive } from '@/api/realtime';
import { RequireAccess } from '@/features/auth/RequireAccess';
import { ExitLink } from '@/features/partner/ExitLink';
import { usePartnerWide } from '@/features/partner/layout';
import { PartnerProvider, usePartnerArea } from '@/features/partner/PartnerProvider';
import { useT } from '@/i18n';
import { Icon, colors, phoneTabBarStyle, tabLabelStyle, type IconName } from '@/ui';

/**
 * Screens without a phone tab (Profile links to them). Hidden, not `href: null`
 * (that redirects); and no width either, or the empty slots squeeze the others.
 */
function phoneHidden(wide: boolean) {
  return wide ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };
}

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} color={typeof color === 'string' ? color : colors.muted} size={22} />;
}

// Partner members only. Sidebar on wide screens, bottom tabs on phones (360 px and up).
export default function PartnerLayout() {
  return (
    <RequireAccess area="partner">
      <PartnerProvider>
        <PartnerTabs />
      </PartnerProvider>
    </RequireAccess>
  );
}

function PartnerTabs() {
  const t = useT();
  const wide = usePartnerWide();
  // Today and Bookings follow booking changes live.
  useCampingBookingsLive(usePartnerArea().camping?.id);
  return (
    <Tabs
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        // Like the customer tabs: an icon with its label below on phones (five
        // tabs of 72 px at 360 px; "Ημερολόγιο" fits at 11 px), beside it in the sidebar.
        // Pitch types, Rates and Team have no phone tab; Profile links to them.
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarLabelStyle: tabLabelStyle(wide ? 15 : 11),
        tabBarStyle: wide ? { width: 220, minWidth: 220 } : phoneTabBarStyle,
        headerTintColor: colors.primary,
        headerRight: () => <ExitLink />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('partner.nav.today'),
          tabBarIcon: ({ color }) => <TabIcon name="calendar-today" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        // The Bookings stack shows its own headers (with a back button on details).
        options={{
          title: t('partner.nav.bookings'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="format-list-bulleted" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('partner.nav.profile'),
          tabBarIcon: ({ color }) => <TabIcon name="tent" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pitch-types"
        options={{
          title: t('partner.nav.pitchTypes'),
          tabBarIcon: ({ color }) => <TabIcon name="view-grid-outline" color={color} />,
          ...phoneHidden(wide),
        }}
      />
      <Tabs.Screen
        name="rates"
        options={{
          title: t('partner.nav.rates'),
          tabBarIcon: ({ color }) => <TabIcon name="cash-multiple" color={color} />,
          ...phoneHidden(wide),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: t('partner.nav.availability'),
          tabBarLabel: t('partner.nav.availabilityShort'),
          tabBarIcon: ({ color }) => <TabIcon name="calendar-range" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: t('partner.nav.reviews'),
          tabBarLabel: wide ? t('partner.nav.reviews') : t('partner.nav.reviewsShort'),
          tabBarIcon: ({ color }) => <TabIcon name="star-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: t('partner.nav.team'),
          tabBarIcon: ({ color }) => <TabIcon name="account-group-outline" color={color} />,
          ...phoneHidden(wide),
        }}
      />
    </Tabs>
  );
}
