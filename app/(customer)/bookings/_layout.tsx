import { Stack } from 'expo-router';

// The tab shows its own header; bookings/[ref] (M4) will push onto this stack.
export default function BookingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
