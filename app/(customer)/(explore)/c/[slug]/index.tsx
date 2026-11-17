import { loadStaticCampings } from '@/api/staticCampings';
import { CampingScreen } from '@/features/camping/CampingScreen';

/** Web: one static page per live camping at build time (SPEC F2). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const campings = await loadStaticCampings();
  return campings.map(({ slug }) => ({ slug }));
}

export default CampingScreen;
