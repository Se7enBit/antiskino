import { launchImageLibraryAsync } from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { photoUrl, useUploadPhoto } from '@/api/photos';
import { isPhotoMimeType, photoMimeType, photoProblem, type PhotoProblem } from '@/domain/photos';
import { useT } from '@/i18n';
import { BodyText, Button, Notice, spacing } from '@/ui';

type Photo = { key: string; path: string };

type Props = {
  campingId: string;
  photos: Photo[];
  canEdit: boolean;
  /** Called with the storage path once the file is uploaded. */
  onAdd: (path: string) => void;
  onRemove: (photo: Photo) => void;
  busy?: boolean;
};

/** Thumbnails with "Add photo" / "Remove" for owners. */
export function PhotoGrid({ campingId, photos, canEdit, onAdd, onRemove, busy = false }: Props) {
  const t = useT();
  const upload = useUploadPhoto(campingId);
  const [problem, setProblem] = useState<PhotoProblem | 'upload' | null>(null);

  const pick = async () => {
    setProblem(null);
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const mimeType = photoMimeType(asset.mimeType, asset.uri);
    const issue = photoProblem(mimeType, asset.fileSize ?? asset.file?.size);
    if (issue || !isPhotoMimeType(mimeType)) {
      setProblem(issue ?? 'type');
      return;
    }
    upload.mutate(
      { uri: asset.uri, mimeType, file: asset.file },
      { onSuccess: onAdd, onError: () => setProblem('upload') },
    );
  };

  return (
    <View style={styles.container}>
      {photos.length === 0 ? <BodyText>{t('photos.empty')}</BodyText> : null}
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.key} style={styles.item}>
            <Image
              source={{ uri: photoUrl(photo.path) }}
              style={styles.image}
              accessibilityIgnoresInvertColors
            />
            {canEdit ? (
              <Button
                label={t('photos.remove')}
                onPress={() => onRemove(photo)}
                disabled={busy}
                testID={`photo-remove-${photo.key}`}
              />
            ) : null}
          </View>
        ))}
      </View>
      {canEdit ? (
        <Button
          label={t('photos.add')}
          onPress={() => void pick()}
          loading={upload.isPending}
          disabled={busy}
          testID="photo-add"
        />
      ) : null}
      {problem ? <Notice tone="error" message={t(`photos.errors.${problem}`)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { gap: spacing.xs, width: 140 },
  image: { width: 140, height: 105, borderRadius: 8 },
});
