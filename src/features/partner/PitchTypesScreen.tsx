import { useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';

import type { Database } from '@/api/database.types';
import { photoUrl } from '@/api/photos';
import { usePitchTypes } from '@/api/pitchTypes';
import { localized, useLanguage, useT } from '@/i18n';
import { Badge, BodyText, Button, Card, Loading, Notice, spacing } from '@/ui';

import { ErrorState } from '../common/ErrorState';

import { PartnerScreen } from './PartnerScreen';
import { PitchTypeEditor } from './PitchTypeEditor';

type PitchTypeRow = Database['public']['Tables']['pitch_types']['Row'];

export function PitchTypesScreen() {
  return (
    <PartnerScreen>
      {({ camping, canEdit }) => <PitchTypesBody campingId={camping.id} canEdit={canEdit} />}
    </PartnerScreen>
  );
}

function PitchTypesBody({ campingId, canEdit }: { campingId: string; canEdit: boolean }) {
  const t = useT();
  const pitchTypes = usePitchTypes(campingId);
  // id of the pitch type being edited, or 'new'
  const [editing, setEditing] = useState<string | null>(null);

  if (pitchTypes.isPending) return <Loading label={t('common.loading')} />;
  if (!pitchTypes.data) return <ErrorState onRetry={() => void pitchTypes.refetch()} />;
  const list = pitchTypes.data;

  return (
    <View style={styles.list}>
      {!canEdit ? <Notice message={t('partner.ownersOnly')} /> : null}
      {canEdit && editing !== 'new' ? (
        <Button
          label={t('partner.pitchTypes.add')}
          variant="primary"
          onPress={() => setEditing('new')}
          testID="pitch-add"
        />
      ) : null}
      {editing === 'new' ? (
        <PitchTypeEditor campingId={campingId} sort={list.length} onDone={() => setEditing(null)} />
      ) : null}
      {list.length === 0 && editing !== 'new' ? (
        <Notice message={t('partner.pitchTypes.empty')} />
      ) : null}
      {list.map((pitchType) =>
        editing === pitchType.id ? (
          <PitchTypeEditor
            key={pitchType.id}
            campingId={campingId}
            pitchType={pitchType}
            sort={pitchType.sort}
            onDone={() => setEditing(null)}
          />
        ) : (
          <PitchTypeCard
            key={pitchType.id}
            pitchType={pitchType}
            onEdit={canEdit ? () => setEditing(pitchType.id) : undefined}
          />
        ),
      )}
    </View>
  );
}

function PitchTypeCard({ pitchType, onEdit }: { pitchType: PitchTypeRow; onEdit?: () => void }) {
  const t = useT();
  const { language } = useLanguage();
  const facts = [
    pitchType.accepts.map((e) => t(`equipment.${e}`)).join(', '),
    t('partner.pitchTypes.people', { count: pitchType.max_people }),
    pitchType.size_m2 ? t('partner.pitchTypes.size', { size: pitchType.size_m2 }) : null,
  ].filter(Boolean);
  const included = localized(pitchType.included, language);

  return (
    <Card title={localized(pitchType.name, language)}>
      {!pitchType.active ? (
        <Badge label={t('partner.pitchTypes.hiddenBadge')} tone="warning" />
      ) : null}
      <BodyText>{facts.join(' · ')}</BodyText>
      {included ? <BodyText>{included}</BodyText> : null}
      {pitchType.photos.length > 0 ? (
        <View style={styles.photos}>
          {pitchType.photos.map((path) => (
            <Image
              key={path}
              source={{ uri: photoUrl(path) }}
              style={styles.photo}
              accessibilityIgnoresInvertColors
            />
          ))}
        </View>
      ) : null}
      {onEdit ? (
        <Button
          label={t('partner.pitchTypes.edit')}
          onPress={onEdit}
          testID={`pitch-edit-${pitchType.id}`}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 96, height: 72, borderRadius: 6 },
});
