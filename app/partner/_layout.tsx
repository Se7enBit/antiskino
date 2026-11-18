import { Tabs } from 'expo-router/tabs';
import { useWindowDimensions } from 'react-native';

import { RequireAccess } from '@/features/auth/RequireAccess';
import { ExitLink } from '@/features/partner/ExitLink';
import { PartnerProvider } from '@/features/partner/PartnerProvider';
import { useT } from '@/i18n';
import { colors } from '@/ui';

const WIDE = 768;

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
  const wide = useWindowDimensions().width >= WIDE;
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
        tabBarLabelStyle: { fontSize: wide ? 15 : 10, fontWeight: '600' },
        tabBarStyle: wide ? { width: 220, minWidth: 220 } : undefined,
        headerTintColor: colors.primary,
        headerRight: () => <ExitLink />,
      }}
    >
      {/* Today (M5) will live at index; until then /partner opens the bookings. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="bookings"
        // The Bookings stack shows its own headers (with a back button on details).
        options={{ title: t('partner.nav.bookings'), headerShown: false }}
      />
      <Tabs.Screen name="profile" options={{ title: t('partner.nav.profile') }} />
      <Tabs.Screen name="pitch-types" options={{ title: t('partner.nav.pitchTypes') }} />
      <Tabs.Screen name="rates" options={{ title: t('partner.nav.rates') }} />
      <Tabs.Screen
        name="availability"
        options={{
          title: t('partner.nav.availability'),
          tabBarLabel: t('partner.nav.availabilityShort'),
        }}
      />
    </Tabs>
  );
}
