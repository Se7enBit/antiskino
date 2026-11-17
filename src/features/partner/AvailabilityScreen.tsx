import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useInventory } from '@/api/inventory';
import { usePitchTypes } from '@/api/pitchTypes';
import { WINDOW_NIGHTS, indexInventory, nightWindow } from '@/domain/availability';
import { useT } from '@/i18n';
import { addDays, todayInAthens, type IsoDate } from '@/lib/dates';
import { BodyText, Button, Card, Loading, Notice, spacing } from '@/ui';

import { AllotmentForm } from './availability/AllotmentForm';
import { AvailabilityGrid, AvailabilityLegend, type Pick } from './availability/AvailabilityGrid';
import { ClosingForm } from './availability/ClosingForm';
import { PartnerScreen } from './PartnerScreen';

export function AvailabilityScreen() {
  return (
    <PartnerScreen>
      {({ camping, canEdit }) => (
        <AvailabilityBody key={camping.id} campingId={camping.id} canEdit={canEdit} />
      )}
    </PartnerScreen>
  );
}

function AvailabilityBody({ campingId, canEdit }: { campingId: string; canEdit: boolean }) {
  const t = useT();
  const [today] = useState(() => todayInAthens());
  const [start, setStart] = useState<IsoDate>(today);
  // the night last tapped in the grid; it fills in the forms
  const [pick, setPick] = useState<Pick | null>(null);
  const pitchTypes = usePitchTypes(campingId);
  const nights = nightWindow(start);
  const inventory = useInventory(
    pitchTypes.data?.map((p) => p.id),
    nights[0]!,
    nights[nights.length - 1]!,
  );

  if (pitchTypes.isPending) return <Loading label={t('common.loading')} />;
  if (!pitchTypes.data) return <Notice tone="error" message={t('common.error')} />;
  if (pitchTypes.data.length === 0)
    return <Notice message={t('partner.availability.noPitchTypes')} />;
  const list = pitchTypes.data;
  const formKey = pick ? `${pick.pitchTypeId}:${pick.night}` : 'none';

  return (
    <View style={styles.page}>
      <Card>
        <View style={styles.nav}>
          <Button
            label={t('partner.availability.earlier')}
            onPress={() => setStart(addDays(start, -WINDOW_NIGHTS))}
            testID="nights-earlier"
          />
          <Button
            label={t('partner.availability.today')}
            onPress={() => setStart(today)}
            selected={start === today}
            testID="nights-today"
          />
          <Button
            label={t('partner.availability.later')}
            onPress={() => setStart(addDays(start, WINDOW_NIGHTS))}
            testID="nights-later"
          />
        </View>
        {inventory.isError ? <Notice tone="error" message={t('common.error')} /> : null}
        {inventory.isPending ? (
          <Loading label={t('common.loading')} />
        ) : (
          <AvailabilityGrid
            pitchTypes={list}
            nights={nights}
            inventory={indexInventory(inventory.data ?? [])}
            today={today}
            onPick={setPick}
          />
        )}
        <AvailabilityLegend />
        <BodyText>{t('partner.availability.tapHint')}</BodyText>
      </Card>
      {canEdit ? (
        <AllotmentForm key={`allotment-${formKey}`} pitchTypes={list} pick={pick} />
      ) : (
        <Notice message={t('partner.availability.allotment.ownersOnly')} />
      )}
      <ClosingForm key={`closing-${formKey}`} pitchTypes={list} pick={pick} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
