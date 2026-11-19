import { router } from 'expo-router';
import { View } from 'react-native';

import { useCamping } from '@/api/partner';
import { useT } from '@/i18n';
import { Button, Loading } from '@/ui';

import { ErrorState } from '../common/ErrorState';

import { CampingPhotos } from './CampingPhotos';
import { CampingProfileForm } from './CampingProfileForm';
import { usePartnerWide } from './layout';
import { PartnerScreen } from './PartnerScreen';

export function ProfileScreen() {
  return (
    <PartnerScreen>
      {({ camping, canEdit }) => <ProfileBody id={camping.id} canEdit={canEdit} />}
    </PartnerScreen>
  );
}

function ProfileBody({ id, canEdit }: { id: string; canEdit: boolean }) {
  const t = useT();
  const wide = usePartnerWide();
  const camping = useCamping(id);
  if (camping.isPending) return <Loading label={t('common.loading')} />;
  if (!camping.data) return <ErrorState onRetry={() => void camping.refetch()} />;
  // key: switching campings starts a fresh form
  return (
    <>
      {/* Phones have no tabs for pitch types, rates and team (they don't fit at 360 px). */}
      {wide ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            label={t('partner.profile.pitchTypesLink')}
            icon="tent"
            onPress={() => router.navigate('/partner/pitch-types')}
            testID="pitch-types-link"
          />
          <Button
            label={t('partner.profile.ratesLink')}
            icon="currency-eur"
            onPress={() => router.navigate('/partner/rates')}
            testID="rates-link"
          />
          {canEdit ? (
            <Button
              label={t('partner.profile.teamLink')}
              icon="account-group-outline"
              onPress={() => router.navigate('/partner/team')}
              testID="team-link"
            />
          ) : null}
        </View>
      )}
      <CampingPhotos campingId={camping.data.id} canEdit={canEdit} />
      <CampingProfileForm key={camping.data.id} camping={camping.data} canEdit={canEdit} />
    </>
  );
}
