import { Link } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { RequireAccess } from '@/features/auth/RequireAccess';
import { PartnerProvider } from '@/features/partner/PartnerProvider';
import { useT } from '@/i18n';
import { colors, spacing } from '@/ui';

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
        headerRight: () => (
          <Link href="/account" style={styles.exit}>
            {t('partner.exit')}
          </Link>
        ),
      }}
    >
      {/* Today (M5) will live at index; until then /partner opens the bookings. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="bookings" options={{ title: t('partner.nav.bookings') }} />
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

const styles = StyleSheet.create({
  exit: { color: colors.primary, fontSize: 16, fontWeight: '600', paddingHorizontal: spacing.md },
});
