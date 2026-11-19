import { Tabs } from 'expo-router/tabs';

import { useCampingBookingsLive } from '@/api/realtime';
import { RequireAccess } from '@/features/auth/RequireAccess';
import { ExitLink } from '@/features/partner/ExitLink';
import { usePartnerWide } from '@/features/partner/layout';
import { PartnerProvider, usePartnerArea } from '@/features/partner/PartnerProvider';
import { useT } from '@/i18n';
import { colors } from '@/ui';

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
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        // Five tabs share 360 px on phones (62 px of label each): "Ημερολόγιο" fits at 10 px.
        // Pitch types, Rates and Team have no phone tab; Profile links to them.
        tabBarLabelStyle: { fontSize: wide ? 15 : 10, fontWeight: '600' },
        tabBarStyle: wide ? { width: 220, minWidth: 220 } : undefined,
        headerTintColor: colors.primary,
        headerRight: () => <ExitLink />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('partner.nav.today') }} />
      <Tabs.Screen
        name="bookings"
        // The Bookings stack shows its own headers (with a back button on details).
        options={{ title: t('partner.nav.bookings'), headerShown: false }}
      />
      <Tabs.Screen name="profile" options={{ title: t('partner.nav.profile') }} />
      <Tabs.Screen
        name="pitch-types"
        options={{
          title: t('partner.nav.pitchTypes'),
          // Hidden, not `href: null`: hidden routes stay reachable from Profile.
          tabBarButton: wide ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="rates"
        options={{ title: t('partner.nav.rates'), tabBarButton: wide ? undefined : () => null }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: t('partner.nav.availability'),
          tabBarLabel: t('partner.nav.availabilityShort'),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: t('partner.nav.reviews'),
          tabBarLabel: wide ? t('partner.nav.reviews') : t('partner.nav.reviewsShort'),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{ title: t('partner.nav.team'), tabBarButton: wide ? undefined : () => null }}
      />
    </Tabs>
  );
}
