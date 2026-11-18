import { StyleSheet, Text } from 'react-native';

import { timeLeft } from '@/domain/today';
import { useLanguage, useT } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors } from '@/ui';

/** "Answer by 6 Jul, 12:00 · 3 h 20 min left", ticking every minute. */
export function RequestDeadline({ deadline }: { deadline: string }) {
  const t = useT();
  const { language } = useLanguage();
  const left = timeLeft(deadline, useNow());
  return (
    <Text style={styles.deadline}>
      {t('partner.bookings.answerBy', { deadline: formatDateTime(deadline, language) })} ·{' '}
      {left ? t('partner.bookings.timeLeft', left) : t('partner.bookings.timeUp')}
    </Text>
  );
}

const styles = StyleSheet.create({
  deadline: { fontSize: 15, fontWeight: '700', color: colors.danger },
});
