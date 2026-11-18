import { StyleSheet, View } from 'react-native';

import { useRates } from '@/api/rates';
import { useT } from '@/i18n';
import { Loading, Notice, spacing } from '@/ui';

import { ErrorState } from '../common/ErrorState';

import { PartnerScreen } from './PartnerScreen';
import { ExtrasSection } from './rates/ExtrasSection';
import { FeesSection } from './rates/FeesSection';
import { GuestCategoriesSection } from './rates/GuestCategoriesSection';
import { PricesSection } from './rates/PricesSection';
import { SeasonsSection } from './rates/SeasonsSection';

export function RatesScreen() {
  return (
    <PartnerScreen>
      {({ camping, canEdit }) => <RatesBody campingId={camping.id} canEdit={canEdit} />}
    </PartnerScreen>
  );
}

function RatesBody({ campingId, canEdit }: { campingId: string; canEdit: boolean }) {
  const t = useT();
  const rates = useRates(campingId);

  if (rates.isPending) return <Loading label={t('common.loading')} />;
  if (!rates.data) return <ErrorState onRetry={() => void rates.refetch()} />;
  const { seasons, guestCategories, extras, fees } = rates.data;
  const props = { campingId, canEdit };

  return (
    <View style={styles.page}>
      {!canEdit ? <Notice message={t('partner.ownersOnly')} /> : null}
      <SeasonsSection {...props} seasons={seasons} />
      <GuestCategoriesSection {...props} guestCategories={guestCategories} />
      <ExtrasSection {...props} extras={extras} />
      <PricesSection
        {...props}
        seasons={seasons}
        guestCategories={guestCategories}
        extras={extras}
      />
      <FeesSection {...props} fees={fees} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
});
