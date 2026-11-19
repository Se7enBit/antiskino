import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePartners } from '@/api/admin';
import { formatBps } from '@/domain/commission';
import { useLanguage, useT } from '@/i18n';
import { BodyText, Button, Card, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { CampingStatusBadge } from './CampingStatusBadge';

export function PartnersList() {
  const t = useT();
  const { language } = useLanguage();
  const partners = usePartners();

  return (
    <Screen>
      <View style={styles.actions}>
        <Button
          label={t('admin.partners.new')}
          variant="primary"
          onPress={() => router.push('/admin/new-partner')}
          testID="new-partner"
        />
        <Button
          label={t('admin.bookings.title')}
          icon="calendar-check-outline"
          onPress={() => router.push('/admin/bookings')}
          testID="admin-bookings"
        />
        <Button
          label={t('admin.commission.title')}
          icon="cash-multiple"
          onPress={() => router.push('/admin/commission')}
          testID="admin-commission"
        />
        <Button
          label={t('admin.reviews.title')}
          icon="star-outline"
          onPress={() => router.push('/admin/reviews')}
          testID="admin-reviews"
        />
      </View>
      {partners.isPending ? <Loading label={t('common.loading')} /> : null}
      {partners.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {partners.data?.length === 0 ? <Notice message={t('admin.partners.empty')} /> : null}
      {partners.data?.map((partner) => (
        <Link
          key={partner.id}
          href={{ pathname: '/admin/partner', params: { id: partner.id } }}
          asChild
        >
          <Pressable accessibilityRole="link" style={({ pressed }) => pressed && styles.pressed}>
            <Card title={partner.name}>
              <BodyText>
                {t('admin.partners.commission')}:{' '}
                {partner.commission_bps === null
                  ? t('admin.partners.commissionDefault')
                  : formatBps(partner.commission_bps, language)}
              </BodyText>
              {partner.campings.length === 0 ? (
                <BodyText>{t('admin.partners.noCampings')}</BodyText>
              ) : (
                partner.campings.map((camping) => (
                  <View key={camping.id} style={styles.camping}>
                    <Text style={styles.campingName}>{camping.name}</Text>
                    <CampingStatusBadge status={camping.status} />
                  </View>
                ))
              )}
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.7 },
  camping: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  campingName: { fontSize: 16, color: colors.text },
});
