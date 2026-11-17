import { useAddCampingPhoto, useCampingPhotos, useRemoveCampingPhoto } from '@/api/photos';
import { PhotoGrid } from '@/features/photos/PhotoGrid';
import { useT } from '@/i18n';
import { BodyText, Card, Loading, Notice } from '@/ui';

/** The camping's photo gallery; changes save immediately. */
export function CampingPhotos({ campingId, canEdit }: { campingId: string; canEdit: boolean }) {
  const t = useT();
  const photos = useCampingPhotos(campingId);
  const add = useAddCampingPhoto(campingId);
  const remove = useRemoveCampingPhoto(campingId);
  const list = photos.data ?? [];
  const nextSort = list.reduce((max, p) => Math.max(max, p.sort), -1) + 1;

  return (
    <Card title={t('photos.title')}>
      {photos.isPending ? (
        <Loading label={t('common.loading')} />
      ) : (
        <>
          <BodyText>{t('photos.firstIsCover')}</BodyText>
          <PhotoGrid
            campingId={campingId}
            photos={list.map((p) => ({ key: p.id, path: p.storage_path }))}
            canEdit={canEdit}
            busy={add.isPending || remove.isPending}
            onAdd={(path) => add.mutate({ path, sort: nextSort })}
            onRemove={(photo) => remove.mutate({ id: photo.key, path: photo.path })}
          />
        </>
      )}
      {photos.isError || add.isError || remove.isError ? (
        <Notice tone="error" message={t('common.error')} />
      ) : null}
    </Card>
  );
}
