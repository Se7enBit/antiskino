import { useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCreateInvite } from '@/api/invites';
import { useTeam, useTeamChange, type TeamInvite, type TeamMember } from '@/api/team';
import { errorCode } from '@/domain/errors';
import { inviteFormSchema, inviteLink } from '@/domain/invites';
import { PARTNER_ROLES, type PartnerRole } from '@/domain/roles';
import { useLanguage, useT } from '@/i18n';
import { formatShortDate } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import {
  BodyText,
  Button,
  ConfirmButton,
  Loading,
  Notice,
  SectionLabel,
  TextField,
  colors,
  spacing,
} from '@/ui';

/** A partner always keeps one owner: SQL error ANT04. */
const LAST_OWNER = 'ANT04';

type Props = {
  partnerId: string;
  partnerName: string;
  /** The role an invite starts with: owners for a new partner (admin), staff otherwise. */
  defaultRole: PartnerRole;
  /** The signed-in user, marked "you" in the list. */
  selfId?: string;
};

/**
 * A partner's team for its owners and admins (SPEC F11 Team, F12): members with
 * their role, pending invites, and invite links to share while emails are off.
 */
export function TeamManager({ partnerId, partnerName, defaultRole, selfId }: Props) {
  const t = useT();
  const team = useTeam(partnerId);
  const change = useTeamChange(partnerId);

  if (team.isPending) return <Loading label={t('common.loading')} />;
  if (team.isError)
    return (
      <View style={styles.block}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void team.refetch()} />
      </View>
    );

  const failure = change.isError
    ? errorCode(change.error) === LAST_OWNER
      ? t('admin.team.lastOwner')
      : t('common.error')
    : null;
  const busy = (key: string) =>
    change.isPending &&
    (change.variables?.kind === 'revoke' ? change.variables.inviteId : change.variables?.userId) ===
      key;
  const invites = team.data.invites.filter((i) => !i.accepted_at);

  return (
    <View style={styles.block}>
      <SectionLabel>{t('admin.team.members')}</SectionLabel>
      {team.data.members.length === 0 ? <BodyText>{t('admin.team.noMembers')}</BodyText> : null}
      {failure ? <Notice tone="error" message={failure} /> : null}
      {team.data.members.map((member) => (
        <MemberRow
          key={member.user_id}
          member={member}
          self={member.user_id === selfId}
          busy={busy(member.user_id)}
          onRole={(role) => change.mutate({ kind: 'role', userId: member.user_id, role })}
          onRemove={() => change.mutate({ kind: 'remove', userId: member.user_id })}
        />
      ))}
      {invites.length > 0 ? <SectionLabel>{t('admin.team.invites')}</SectionLabel> : null}
      {invites.map((invite) => (
        <InviteRow
          key={invite.id}
          invite={invite}
          busy={busy(invite.id)}
          onRevoke={() => change.mutate({ kind: 'revoke', inviteId: invite.id })}
        />
      ))}
      <InviteForm partnerId={partnerId} partnerName={partnerName} defaultRole={defaultRole} />
    </View>
  );
}

function MemberRow({
  member,
  self,
  busy,
  onRole,
  onRemove,
}: {
  member: TeamMember;
  self: boolean;
  busy: boolean;
  onRole: (role: PartnerRole) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const other: PartnerRole = member.role === 'owner' ? 'staff' : 'owner';
  return (
    <View style={styles.row} testID={`member-${member.user_id}`}>
      <Text style={styles.name}>
        {member.full_name ?? t('admin.team.unnamed')} · {t(`admin.roles.${member.role}`)}
        {self ? ` · ${t('admin.team.you')}` : ''}
      </Text>
      <Text style={styles.muted}>{member.email}</Text>
      <View style={styles.actions}>
        <Button
          label={t(`admin.team.make.${other}`)}
          onPress={() => onRole(other)}
          loading={busy}
          testID={`member-role-${member.user_id}`}
        />
        <ConfirmButton
          label={t('admin.team.remove')}
          question={t('admin.team.removeQuestion', {
            name: member.full_name ?? member.email,
          })}
          yes={t('admin.team.removeYes')}
          no={t('manage.cancelNo')}
          onConfirm={onRemove}
          loading={busy}
          testID={`member-remove-${member.user_id}`}
        />
      </View>
    </View>
  );
}

function InviteRow({
  invite,
  busy,
  onRevoke,
}: {
  invite: TeamInvite;
  busy: boolean;
  onRevoke: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const expired = new Date(invite.expires_at) < new Date();
  return (
    <View style={styles.row} testID={`invite-${invite.id}`}>
      <Text style={styles.name}>
        {invite.email} · {t(`admin.roles.${invite.role}`)} ·{' '}
        {expired
          ? t('admin.team.expired')
          : t('admin.team.pending', { date: formatShortDate(invite.expires_at, language) })}
      </Text>
      <View style={styles.actions}>
        <Button
          label={t('admin.team.revoke')}
          onPress={onRevoke}
          loading={busy}
          testID={`invite-revoke-${invite.id}`}
        />
      </View>
    </View>
  );
}

function InviteForm({
  partnerId,
  partnerName,
  defaultRole,
}: {
  partnerId: string;
  partnerName: string;
  defaultRole: PartnerRole;
}) {
  const t = useT();
  const createInvite = useCreateInvite(partnerId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PartnerRole>(defaultRole);
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
      <SectionLabel>{t('admin.team.invite')}</SectionLabel>
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
      <View style={styles.actions}>
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
  block: { gap: spacing.sm },
  row: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  form: { gap: spacing.sm, paddingTop: spacing.md },
  link: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  linkText: { fontSize: 14, color: colors.text, padding: 0 },
});
