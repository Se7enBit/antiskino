import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCommissionMonth, useSetStatementStatus, type StatementStatus } from '@/api/commission';
import { commissionCsv, summarizeCommission, type PartnerCommission } from '@/domain/commission';
import { useLanguage, useT } from '@/i18n';
import { addMonths, monthStart, todayInAthens } from '@/lib/dates';
import { formatMonth } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { saveTextFile } from '@/lib/saveFile';
import { Badge, BodyText, Button, Card, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { ErrorState } from '../common/ErrorState';

const TONES: Record<StatementStatus, 'success' | 'warning' | 'neutral'> = {
  open: 'warning',
  sent: 'neutral',
  paid: 'success',
};

/**
 * /admin/commission: each partner's commission on the stays completed in a
 * month (by departure), the statement's status, and a CSV of the stays (SPEC F12).
 */
export function AdminCommission() {
  const t = useT();
  const { language } = useLanguage();
  // Last month by default: its stays are all completed.
  const [month, setMonth] = useState(() => addMonths(monthStart(todayInAthens()), -1));
  const data = useCommissionMonth(month);
  const setStatus = useSetStatementStatus(month);

  const download = () => {
    if (!data.data) return;
    const csv = commissionCsv(
      data.data.lines,
      [
        t('admin.commission.csv.partner'),
        t('admin.commission.csv.camping'),
        t('admin.commission.csv.ref'),
        t('admin.commission.csv.arrival'),
        t('admin.commission.csv.departure'),
        t('admin.commission.csv.nights'),
        t('admin.commission.csv.stay'),
        t('admin.commission.csv.rate'),
        t('admin.commission.csv.commission'),
      ],
      language,
    );
    void saveTextFile(`antiskino-commission-${month.slice(0, 7)}.csv`, csv, 'text/csv');
  };

  let body;
  if (data.isPending) body = <Loading label={t('common.loading')} />;
  else if (data.isError) body = <ErrorState onRetry={() => void data.refetch()} />;
  else {
    const partners = summarizeCommission(data.data.lines);
    const statusOf = new Map(data.data.statements.map((s) => [s.partner_id, s]));
    body =
      partners.length === 0 ? (
        <Notice message={t('admin.commission.none')} />
      ) : (
        <>
          {partners.map((partner) => {
            const statement = statusOf.get(partner.partnerId);
            return (
              <PartnerStatement
                key={partner.partnerId}
                partner={partner}
                status={(statement?.status as StatementStatus | undefined) ?? 'open'}
                markedCents={statement?.total_cents ?? null}
                busy={setStatus.isPending && setStatus.variables?.partnerId === partner.partnerId}
                onStatus={(status) => setStatus.mutate({ partnerId: partner.partnerId, status })}
              />
            );
          })}
          {setStatus.isError ? <Notice tone="error" message={t('common.error')} /> : null}
          <View style={styles.row}>
            <Button
              label={t('admin.commission.download')}
              icon="download"
              onPress={download}
              testID="commission-csv"
            />
          </View>
        </>
      );
  }

  return (
    <Screen>
      <View style={styles.monthRow}>
        <Button
          label="‹"
          accessibilityLabel={t('search.previousMonth')}
          onPress={() => setMonth(addMonths(month, -1))}
          testID="month-prev"
        />
        <Text style={styles.month} accessibilityRole="header">
          {formatMonth(month, language)}
        </Text>
        <Button
          label="›"
          accessibilityLabel={t('search.nextMonth')}
          onPress={() => setMonth(addMonths(month, 1))}
          testID="month-next"
        />
      </View>
      <BodyText>{t('admin.commission.hint')}</BodyText>
      {body}
    </Screen>
  );
}

function PartnerStatement({
  partner,
  status,
  markedCents,
  busy,
  onStatus,
}: {
  partner: PartnerCommission;
  status: StatementStatus;
  markedCents: number | null;
  busy: boolean;
  onStatus: (status: StatementStatus) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.name}>{partner.partnerName}</Text>
        <Badge label={t(`admin.commission.status.${status}`)} tone={TONES[status]} />
      </View>
      <BodyText>
        {t('admin.commission.stays', {
          count: partner.stays,
          value: formatMoney(partner.staysCents, language),
        })}
      </BodyText>
      <Text style={styles.due} testID={`commission-due-${partner.partnerId}`}>
        {t('admin.commission.due', { amount: formatMoney(partner.commissionCents, language) })}
      </Text>
      {markedCents !== null && markedCents !== partner.commissionCents ? (
        <Notice
          message={t('admin.commission.changed', { amount: formatMoney(markedCents, language) })}
        />
      ) : null}
      <View style={styles.row}>
        {status !== 'sent' ? (
          <Button
            label={t('admin.commission.markSent')}
            onPress={() => onStatus('sent')}
            loading={busy}
            testID={`mark-sent-${partner.partnerId}`}
          />
        ) : null}
        {status !== 'paid' ? (
          <Button
            label={t('admin.commission.markPaid')}
            variant="primary"
            onPress={() => onStatus('paid')}
            loading={busy}
            testID={`mark-paid-${partner.partnerId}`}
          />
        ) : null}
        {status !== 'open' ? (
          <Button
            label={t('admin.commission.reopen')}
            onPress={() => onStatus('open')}
            loading={busy}
            testID={`mark-open-${partner.partnerId}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 20, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  due: { fontSize: 17, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
