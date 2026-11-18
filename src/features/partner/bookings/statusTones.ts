import type { BookingStatus } from '@/api/guestBooking';

/** Badge colours for booking statuses in the partner area. */
export const STATUS_TONES: Record<BookingStatus, 'success' | 'warning' | 'neutral'> = {
  held: 'warning',
  requested: 'warning',
  confirmed: 'success',
  checked_in: 'success',
  completed: 'neutral',
  declined: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  no_show: 'neutral',
};
