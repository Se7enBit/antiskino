import type { CampingStatus } from '@/domain/roles';
import { useT } from '@/i18n';
import { Badge } from '@/ui';

const TONES = { draft: 'neutral', live: 'success', paused: 'warning' } as const;

export function CampingStatusBadge({ status }: { status: CampingStatus }) {
  const t = useT();
  return <Badge label={t(`admin.status.${status}`)} tone={TONES[status]} />;
}
