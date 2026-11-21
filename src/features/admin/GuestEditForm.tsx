import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useUpdateBookingGuest } from '@/api/admin';
import type { PartnerBooking } from '@/api/partnerBookings';
import { guestContactSchema, type GuestContactForm } from '@/domain/booking';
import { fieldErrors } from '@/domain/partners';
import { useT } from '@/i18n';
import { Button, ChoiceGroup, Notice, SectionLabel, TextField, spacing } from '@/ui';

type Field = keyof GuestContactForm;

/** Admins correct a guest's contact details (a typo in the email, a wrong phone). */
export function GuestEditForm({ booking }: { booking: PartnerBooking }) {
  const t = useT();
  const update = useUpdateBookingGuest();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GuestContactForm>(() => ({
    name: booking.guest_name,
    email: booking.guest_email,
    phone: booking.guest_phone,
    country: booking.guest_country,
    locale: booking.locale === 'en' ? 'en' : 'el',
  }));
  const [errors, setErrors] = useState<Partial<Record<Field, true>>>({});

  if (!open)
    return (
      <View style={styles.block}>
        {update.isSuccess ? <Notice message={t('admin.booking.saved')} /> : null}
        <Button
          label={t('admin.booking.editGuest')}
          icon="account"
          onPress={() => setOpen(true)}
          testID="admin-edit-guest"
        />
      </View>
    );

  const field = (key: 'name' | 'email' | 'phone' | 'country') => ({
    label: t(key === 'country' ? 'booking.details.countryCode' : `booking.details.${key}`),
    value: form[key],
    onChangeText: (text: string) => setForm((current) => ({ ...current, [key]: text })),
    error: errors[key] ? t(`booking.errors.${key}`) : null,
    testID: `admin-guest-${key}`,
  });

  const save = () => {
    const parsed = guestContactSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors<Field>(parsed.error));
    setErrors({});
    update.mutate(
      { bookingId: booking.id, guest: parsed.data },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <View style={styles.block}>
      <TextField {...field('name')} />
      <TextField {...field('email')} keyboardType="email-address" autoCapitalize="none" />
      <TextField {...field('phone')} keyboardType="phone-pad" />
      <TextField {...field('country')} autoCapitalize="characters" maxLength={2} />
      <SectionLabel>{t('booking.details.language')}</SectionLabel>
      <ChoiceGroup
        options={[
          { value: 'el', label: t('partner.booking.locale.el') },
          { value: 'en', label: t('partner.booking.locale.en') },
        ]}
        selected={form.locale}
        onChange={(locale) => setForm((current) => ({ ...current, locale }))}
        testID="admin-guest-locale"
      />
      {update.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      <View style={styles.row}>
        <Button
          label={t('admin.booking.saveGuest')}
          variant="primary"
          onPress={save}
          loading={update.isPending}
          testID="admin-guest-save"
        />
        <Button label={t('common.cancel')} onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
