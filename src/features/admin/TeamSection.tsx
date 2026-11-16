import { useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { usePartnerTeam } from '@/api/admin';
import { useCreateInvite } from '@/api/invites';
import { inviteFormSchema, inviteLink } from '@/domain/invites';
import { PARTNER_ROLES, type PartnerRole } from '@/domain/roles';
import { useLanguage, useT } from '@/i18n';
import { formatShortDate } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import {
  BodyText,
  Button,
  Card,
  Loading,
  Notice,
  SectionLabel,
  TextField,
  colors,
  spacing,
} from '@/ui';

export function TeamSection({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const t = useT();
  const { language } = useLanguage();
  const team = usePartnerTeam(partnerId);

  return (
    <Card title={t('admin.team.title')}>
      {team.isPending ? <Loading label={t('common.loading')} /> : null}
      {team.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {team.data ? (
        <>
          <SectionLabel>{t('admin.team.members')}</SectionLabel>
          {team.data.members.length === 0 ? <BodyText>{t('admin.team.noMembers')}</BodyText> : null}
          {team.data.members.map((member) => (
            <Text key={member.user_id} style={styles.row}>
              {member.full_name ?? t('admin.team.unnamed')} · {t(`admin.roles.${member.role}`)}
            </Text>
          ))}
          {team.data.invites.length > 0 ? (
            <SectionLabel>{t('admin.team.invites')}</SectionLabel>
          ) : null}
          {team.data.invites.map((invite) => (
            <Text key={invite.id} style={styles.row}>
              {invite.email} · {t(`admin.roles.${invite.role}`)} ·{' '}
              {invite.accepted_at
                ? t('admin.team.accepted')
                : new Date(invite.expires_at) < new Date()
                  ? t('admin.team.expired')
                  : t('admin.team.pending', { date: formatShortDate(invite.expires_at, language) })}
            </Text>
          ))}
        </>
      ) : null}
      <InviteForm partnerId={partnerId} partnerName={partnerName} />
    </Card>
  );
}

function InviteForm({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const t = useT();
  const createInvite = useCreateInvite(partnerId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PartnerRole>('owner');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const base = siteUrl();

  const submit = () => {
    const parsed = inviteFormSchema.safeParse({ email, role });
    setInvalidEmail(!parsed.success);
    if (!parsed.success || !base) return;
    createInvite.mutate(parsed.data, {
      onSuccess: (token) => {
        setCreated({ email: parsed.data.email, link: inviteLink(base, token) });
        setEmail('');
      },
    });
  };

  const share = (link: string) => {
    // Share sheet on phones; browsers without it keep the link visible to copy.
    Share.share({ message: t('admin.team.shareMessage', { partner: partnerName, link }) }).catch(
      () => {},
    );
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t('admin.team.email')}
        value={email}
        onChangeText={setEmail}
        error={invalidEmail ? t('admin.team.errors.email') : null}
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        testID="invite-email"
      />
      <SectionLabel>{t('admin.team.role')}</SectionLabel>
      <View style={styles.roles}>
        {PARTNER_ROLES.map((option) => (
          <Button
            key={option}
            label={t(`admin.roles.${option}`)}
            selected={option === role}
            onPress={() => setRole(option)}
            testID={`invite-role-${option}`}
          />
        ))}
      </View>
      <Button
        label={t('admin.team.createLink')}
        variant="primary"
        onPress={submit}
        loading={createInvite.isPending}
        disabled={!base}
        testID="invite-create"
      />
      {!base ? <Notice tone="error" message={t('admin.team.noSiteUrl')} /> : null}
      {createInvite.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {created ? (
        <View style={styles.link}>
          <BodyText>{t('admin.team.linkReady', { email: created.email })}</BodyText>
          <TextInput
            value={created.link}
            editable={false}
            selectTextOnFocus
            multiline
            style={styles.linkText}
            testID="invite-link"
          />
          <Button
            label={t('admin.team.share')}
            onPress={() => share(created.link)}
            testID="invite-share"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { fontSize: 15, lineHeight: 22, color: colors.text },
  form: { gap: spacing.sm, paddingTop: spacing.md },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  linkText: { fontSize: 14, color: colors.text, padding: 0 },
});
