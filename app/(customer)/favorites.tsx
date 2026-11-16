import { useT } from '@/i18n';
import { Placeholder } from '@/ui';

export default function FavoritesScreen() {
  const t = useT();
  return <Placeholder title={t('favorites.title')} body={t('favorites.body')} />;
}
