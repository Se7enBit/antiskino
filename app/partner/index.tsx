import { Redirect } from 'expo-router';

// Today (M5) will live here; until then /partner opens the bookings.
export default function PartnerHome() {
  return <Redirect href="/partner/bookings" />;
}
