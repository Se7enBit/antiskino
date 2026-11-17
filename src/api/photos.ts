import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { newPhotoPath, type PhotoMimeType } from '@/domain/photos';
import { getSupabase } from '@/lib/supabase';

const BUCKET = 'photos';

export type PickedPhoto = { uri: string; mimeType: PhotoMimeType; file?: Blob };

/** Public URL of a stored photo (the bucket is public). */
export function photoUrl(path: string): string {
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Web gives us the File; native gives a file:// URI we read into an ArrayBuffer. */
async function photoBody(photo: PickedPhoto): Promise<Blob | ArrayBuffer> {
  if (photo.file) return photo.file;
  const response = await fetch(photo.uri);
  return response.arrayBuffer();
}

/** Uploads a photo into the camping's folder and returns its storage path. */
export function useUploadPhoto(campingId: string) {
  return useMutation({
    mutationFn: async (photo: PickedPhoto) => {
      const path = newPhotoPath(campingId, photo.mimeType);
      const { error } = await getSupabase()
        .storage.from(BUCKET)
        .upload(path, await photoBody(photo), { contentType: photo.mimeType, upsert: false });
      if (error) throw error;
      return path;
    },
  });
}

/** Deletes stored files; failures are ignored (an orphaned file is harmless). */
async function removeFiles(paths: string[]) {
  if (paths.length > 0) await getSupabase().storage.from(BUCKET).remove(paths);
}

export function useCampingPhotos(campingId: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'camping-photos', campingId],
    queryFn: campingId
      ? async () => {
          const { data, error } = await getSupabase()
            .from('camping_photos')
            .select('id, storage_path, sort')
            .eq('camping_id', campingId)
            .order('sort');
          if (error) throw error;
          return data;
        }
      : skipToken,
  });
}

export function useAddCampingPhoto(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, sort }: { path: string; sort: number }) => {
      const { error } = await getSupabase()
        .from('camping_photos')
        .insert({ camping_id: campingId, storage_path: path, sort });
      if (error) {
        await removeFiles([path]);
        throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['partner', 'camping-photos', campingId] }),
  });
}

export function useRemoveCampingPhoto(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      const { error } = await getSupabase().from('camping_photos').delete().eq('id', id);
      if (error) throw error;
      await removeFiles([path]);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['partner', 'camping-photos', campingId] }),
  });
}

/** Replaces a pitch type's photo list; removed files are deleted afterwards. */
export function useSetPitchTypePhotos(campingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pitchTypeId,
      photos,
      removed = [],
    }: {
      pitchTypeId: string;
      photos: string[];
      removed?: string[];
    }) => {
      const { error } = await getSupabase()
        .from('pitch_types')
        .update({ photos })
        .eq('id', pitchTypeId)
        .select('id')
        .single();
      if (error) throw error;
      await removeFiles(removed);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['partner', 'pitch-types', campingId] }),
  });
}
