import { View } from 'react-native';

import { useMyAccess } from '@/api/access';
import { MUTABLE_EMAILS, useMutedEmails, useSetMutedEmails } from '@/api/emailSettings';
import { useT } from '@/i18n';
import { BodyText, Card, Checkbox, Notice } from '@/ui';

/** Which booking emails a partner member gets (Account tab). */
export function EmailSettings() {
  const t = useT();
  const { data: access } = useMyAccess();
  const muted = useMutedEmails();
  const save = useSetMutedEmails();

  if (!access || access.memberships.length === 0 || !muted.data) return null;
  // While saving, show the choice just made.
  const current = save.isPending && save.variables ? save.variables : muted.data;

  return (
    <Card title={t('account.emails.title')}>
      <BodyText>{t('account.emails.explain')}</BodyText>
      <View>
        {MUTABLE_EMAILS.map((kind) => (
          <Checkbox
            key={kind}
            label={t(`account.emails.kinds.${kind}`)}
            checked={!current.includes(kind)}
            onChange={(on) =>
              save.mutate(on ? current.filter((k) => k !== kind) : [...current, kind])
            }
            testID={`email-${kind}`}
          />
        ))}
      </View>
      {save.isError ? <Notice tone="error" message={t('common.error')} /> : null}
    </Card>
  );
}
