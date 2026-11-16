import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCreateCamping, useSetCampingStatus } from '@/api/admin';
import { UNIQUE_VIOLATION, errorCode } from '@/domain/errors';
import { campingFormSchema, fieldErrors, type CampingFormField } from '@/domain/partners';
import type { CampingStatus } from '@/domain/roles';
import { slugify } from '@/domain/slug';
import { useT } from '@/i18n';
import { BodyText, Button, Card, Notice, TextField, colors, spacing } from '@/ui';

import { CampingStatusBadge } from './CampingStatusBadge';

type Camping = {
  id: string;
  name: string;
  slug: string;
  status: CampingStatus;
  region: string | null;
};

// Status changes offered for each current status.
const NEXT: Record<CampingStatus, { to: CampingStatus; label: 'publish' | 'pause' | 'toDraft' }[]> =
  {
    draft: [{ to: 'live', label: 'publish' }],
    live: [{ to: 'paused', label: 'pause' }],
    paused: [
      { to: 'live', label: 'publish' },
      { to: 'draft', label: 'toDraft' },
    ],
  };

export function CampingsSection({
  partnerId,
  campings,
}: {
  partnerId: string;
  campings: Camping[];
}) {
  const t = useT();
  const setStatus = useSetCampingStatus(partnerId);
  const [adding, setAdding] = useState(false);

  return (
    <Card title={t('admin.campings.title')}>
      {campings.length === 0 ? <BodyText>{t('admin.campings.empty')}</BodyText> : null}
      {campings.map((camping) => (
        <View key={camping.id} style={styles.camping}>
          <View style={styles.heading}>
            <Text style={styles.name}>{camping.name}</Text>
            <CampingStatusBadge status={camping.status} />
          </View>
          <BodyText>
            /c/{camping.slug}
            {camping.region ? ` · ${camping.region}` : ''}
          </BodyText>
          <View style={styles.actions}>
            {NEXT[camping.status].map((action) => (
              <Button
                key={action.to}
                label={t(`admin.campings.${action.label}`)}
                onPress={() => setStatus.mutate({ campingId: camping.id, status: action.to })}
                disabled={setStatus.isPending}
                testID={`camping-${camping.slug}-${action.to}`}
              />
            ))}
          </View>
        </View>
      ))}
      {setStatus.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {adding ? (
        <NewCampingForm partnerId={partnerId} onDone={() => setAdding(false)} />
      ) : (
        <Button
          label={t('admin.campings.add')}
          onPress={() => setAdding(true)}
          testID="camping-add"
        />
      )}
    </Card>
  );
}

function NewCampingForm({ partnerId, onDone }: { partnerId: string; onDone: () => void }) {
  const t = useT();
  const createCamping = useCreateCamping(partnerId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [region, setRegion] = useState('');
  const [errors, setErrors] = useState<Partial<Record<CampingFormField, true>>>({});

  const error = (field: CampingFormField) =>
    errors[field] ? t(`admin.campings.errors.${field}`) : null;
  const slugTaken = errorCode(createCamping.error) === UNIQUE_VIOLATION;

  const submit = () => {
    const parsed = campingFormSchema.safeParse({ name, slug, region });
    if (!parsed.success) {
      setErrors(fieldErrors<CampingFormField>(parsed.error));
      return;
    }
    setErrors({});
    createCamping.mutate(parsed.data, { onSuccess: onDone });
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t('admin.campings.name')}
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (!slugEdited) setSlug(slugify(text));
        }}
        error={error('name')}
        autoFocus
        testID="camping-name"
      />
      <TextField
        label={t('admin.campings.slug')}
        value={slug}
        onChangeText={(text) => {
          setSlugEdited(true);
          setSlug(text);
        }}
        error={slugTaken ? t('admin.campings.slugTaken') : error('slug')}
        autoCapitalize="none"
        testID="camping-slug"
      />
      <BodyText>{t('admin.campings.slugHint', { slug: slug || 'camping' })}</BodyText>
      <TextField
        label={t('admin.campings.region')}
        value={region}
        onChangeText={setRegion}
        error={error('region')}
        testID="camping-region"
      />
      <View style={styles.actions}>
        <Button
          label={t('admin.campings.create')}
          variant="primary"
          onPress={submit}
          loading={createCamping.isPending}
          testID="camping-create"
        />
        <Button label={t('common.cancel')} onPress={onDone} />
      </View>
      {createCamping.isError && !slugTaken ? (
        <Notice tone="error" message={t('common.error')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  camping: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  form: { gap: spacing.md, paddingTop: spacing.sm },
});
