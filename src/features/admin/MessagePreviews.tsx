import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMessagePreviews } from '@/api/messagePreviews';
import { LANGUAGES, useT, type Language } from '@/i18n';
import { BodyText, Card, ChoiceGroup, Loading, Screen, SectionLabel, colors, spacing } from '@/ui';

import { ErrorState } from '../common/ErrorState';
import { EmailFrame } from './EmailFrame';

type Audience = 'guest' | 'partner';

/** The kinds the app names; anything new still shows, under its code. */
const KINDS = [
  'booking_confirmed',
  'request_received',
  'request_expiring',
  'request_declined',
  'request_expired',
  'booking_cancelled',
  'arrival_reminder',
  'review_invite',
  'review_received',
] as const;
type Kind = (typeof KINDS)[number];
const isKind = (kind: string): kind is Kind => (KINDS as readonly string[]).includes(kind);

/**
 * /admin/messages: every email and push guests and teams get, with a sample
 * booking, in Greek or English, to read the texts without making bookings.
 */
export function MessagePreviews() {
  const t = useT();
  const previews = useMessagePreviews();
  const [locale, setLocale] = useState<Language>('el');
  const [audience, setAudience] = useState<Audience>('guest');

  if (previews.isPending) return <Loading label={t('common.loading')} />;
  if (previews.isError) return <ErrorState onRetry={() => void previews.refetch()} />;
  const shown = previews.data.previews.filter(
    (p) => p.locale === locale && p.audience === audience,
  );

  return (
    <Screen>
      <BodyText>{t('admin.messages.intro')}</BodyText>
      <ChoiceGroup
        options={(['guest', 'partner'] as const).map((value) => ({
          value,
          label: t(`admin.messages.audience.${value}`),
        }))}
        selected={audience}
        onChange={setAudience}
        testID="messages-audience"
      />
      <ChoiceGroup
        options={LANGUAGES.map((value) => ({ value, label: t(`account.languages.${value}`) }))}
        selected={locale}
        onChange={setLocale}
        testID="messages-locale"
      />
      {shown.map((p) => (
        <Card
          key={`${p.kind}-${p.audience}-${p.locale}`}
          title={isKind(p.kind) ? t(`admin.messages.kinds.${p.kind}`) : p.kind}
        >
          {p.push ? (
            <View style={styles.block}>
              <SectionLabel>{t('admin.messages.push')}</SectionLabel>
              <Text style={styles.pushTitle}>{p.push.title}</Text>
              <BodyText>{p.push.body}</BodyText>
            </View>
          ) : null}
          {p.email ? (
            <View style={styles.block}>
              <SectionLabel>{t('admin.messages.email')}</SectionLabel>
              <Text style={styles.subject} selectable>
                {p.email.subject}
              </Text>
              <EmailFrame html={p.email.html} text={p.email.text} title={p.email.subject} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  pushTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
});
