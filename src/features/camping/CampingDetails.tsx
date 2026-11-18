import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import type { CampingPage } from '@/api/camping';
import { isAmenity } from '@/domain/amenities';
import { directionsUrl, shortTime } from '@/domain/camping';
import { localized, useLanguage, useT } from '@/i18n';
import { BodyText, Button, Card, Icon, PinsMap, colors, spacing } from '@/ui';

import { AMENITY_ICONS } from './icons';

/** About, amenities, times, booking terms, house rules and location (SPEC F2). */
export function CampingDetails({ camping }: { camping: CampingPage }) {
  const t = useT();
  const { language } = useLanguage();
  const descr = localized(camping.descr, language);
  const rules = localized(camping.house_rules, language);
  const amenities = camping.amenities.filter(isAmenity);
  const checkIn = shortTime(camping.check_in_from);
  const checkOut = shortTime(camping.check_out_until);
  const { lat, lng } = camping;

  return (
    <>
      {descr ? (
        <Card title={t('camping.about')}>
          <BodyText>{descr}</BodyText>
        </Card>
      ) : null}
      {amenities.length ? (
        <Card title={t('camping.amenities')}>
          <View style={styles.grid}>
            {amenities.map((amenity) => (
              <View key={amenity} style={styles.amenity}>
                <Icon name={AMENITY_ICONS[amenity]} color={colors.primary} />
                <Text style={styles.text}>{t(`amenities.${amenity}`)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {checkIn || checkOut ? (
        <Card title={t('camping.times')}>
          {checkIn ? <BodyText>{t('camping.checkIn', { time: checkIn })}</BodyText> : null}
          {checkOut ? <BodyText>{t('camping.checkOut', { time: checkOut })}</BodyText> : null}
        </Card>
      ) : null}
      <Card title={t('camping.terms')}>
        <BodyText>
          {camping.confirmation_mode === 'request'
            ? t('camping.confirmation.request', { hours: camping.request_expiry_hours })
            : t('camping.confirmation.instant')}
        </BodyText>
        <BodyText>{t(`camping.payment.${camping.payment_mode}`)}</BodyText>
        <BodyText>{t(`camping.cancellation.${camping.cancellation_policy}`)}</BodyText>
        {camping.payment_mode === 'on_site' ? <BodyText>{t('camping.onSiteFree')}</BodyText> : null}
      </Card>
      {rules ? (
        <Card title={t('camping.houseRules')}>
          <BodyText>{rules}</BodyText>
        </Card>
      ) : null}
      {camping.address || (lat !== null && lng !== null) ? (
        <Card title={t('camping.location')}>
          {camping.address ? <BodyText>{camping.address}</BodyText> : null}
          {lat !== null && lng !== null ? (
            <PinsMap
              height={220}
              pins={[{ id: camping.id, lat, lng, title: camping.name, label: camping.name }]}
            />
          ) : null}
          {lat !== null && lng !== null ? (
            <Button
              label={t('camping.directions')}
              icon="directions"
              onPress={() => void Linking.openURL(directionsUrl(lat, lng, Platform.OS))}
              testID="camping-directions"
            />
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 140 },
  text: { fontSize: 15, color: colors.text },
});
