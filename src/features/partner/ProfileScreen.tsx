import { router } from 'expo-router';
import { View } from 'react-native';

import { useCamping } from '@/api/partner';
import { useT } from '@/i18n';
import { Button, Loading, Notice } from '@/ui';

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
  if (!camping.data) return <Notice tone="error" message={t('common.error')} />;
  // key: switching campings starts a fresh form
  return (
    <>
      {/* Phones have no tab for pitch types (six tabs don't fit at 360 px). */}
      {wide ? null : (
        <View style={{ flexDirection: 'row' }}>
          <Button
            label={t('partner.profile.pitchTypesLink')}
            icon="tent"
            onPress={() => router.navigate('/partner/pitch-types')}
            testID="pitch-types-link"
          />
        </View>
      )}
      <CampingPhotos campingId={camping.data.id} canEdit={canEdit} />
      <CampingProfileForm key={camping.data.id} camping={camping.data} canEdit={canEdit} />
    </>
  );
}
