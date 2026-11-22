import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Button, Loading, Notice, Screen, spacing } from '@/ui';

import { usePartnerArea, type MyCamping } from './PartnerProvider';

type Props = { children: (context: { camping: MyCamping; canEdit: boolean }) => ReactNode };

/** Page frame for partner screens: loading/empty states and the camping switcher. */
export function PartnerScreen({ children }: Props) {
  const t = useT();
  const { isPending, isError, campings, camping, selectCamping, canEdit } = usePartnerArea();

  if (isPending) return <Loading label={t('common.loading')} />;
  return (
    <Screen>
      {isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {!isError && !camping ? <Notice message={t('partner.noCampings')} /> : null}
      {campings.length > 1 ? (
        <View style={styles.switcher} accessibilityRole="radiogroup">
          {campings.map((c) => (
            <Button
              key={c.id}
              label={c.name}
              choice="radio"
              selected={c.id === camping?.id}
              onPress={() => selectCamping(c.id)}
              testID={`camping-switch-${c.slug}`}
            />
          ))}
        </View>
      ) : null}
      {camping ? children({ camping, canEdit }) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
