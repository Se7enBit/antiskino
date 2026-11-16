import { useLocalSearchParams } from 'expo-router';

import { inviteTokenSchema } from '@/domain/invites';
import { AcceptInvite } from '@/features/invites/AcceptInvite';

// /invite?t=<token>: a query parameter, because static web hosting cannot
// pre-render one page per token.
export default function InviteScreen() {
  const { t } = useLocalSearchParams();
  const token = inviteTokenSchema.safeParse(t);
  return <AcceptInvite token={token.success ? token.data : undefined} />;
}
