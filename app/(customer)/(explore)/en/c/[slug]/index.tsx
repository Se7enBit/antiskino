import { loadStaticCampings } from '@/api/staticCampings';
import { CampingScreen } from '@/features/camping/CampingScreen';

/** Web: the English page of each live camping, at /en/c/<slug>/ (SPEC F2). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const campings = await loadStaticCampings();
  return campings.map(({ slug }) => ({ slug }));
}

export default function EnglishCampingScreen() {
  return <CampingScreen language="en" />;
}
