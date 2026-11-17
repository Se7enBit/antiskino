import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { COUNTRIES, guestFormSchema, type GuestDetails, type GuestForm } from '@/domain/booking';
import { fieldErrors } from '@/domain/partners';
import { useT } from '@/i18n';
import { LANGUAGES } from '@/i18n/languages';
import {
  BodyText,
  Button,
  Card,
  ChoiceGroup,
  Notice,
  SectionLabel,
  TextField,
  spacing,
} from '@/ui';

type Props = {
  guest: GuestForm;
  onChange: (patch: Partial<GuestForm>) => void;
  onBack: () => void;
  onContinue: (details: GuestDetails) => void;
};

type Field = keyof GuestForm;
const OTHER = 'other';

/** Step 2: who is coming (SPEC F3). */
export function DetailsStep({ guest, onChange, onBack, onContinue }: Props) {
  const t = useT();
  const [errors, setErrors] = useState<Partial<Record<Field, true>>>({});
  const listed = (COUNTRIES as readonly string[]).includes(guest.country);
  const [otherCountry, setOtherCountry] = useState(!listed);

  const message = (field: Field) => {
    if (!errors[field]) return null;
    if (field === 'vehiclePlate' || field === 'note') return t('booking.errors.tooLong');
    if (field === 'locale') return null;
    return t(`booking.errors.${field}`);
  };
  const field = (key: 'name' | 'email' | 'phone' | 'vehiclePlate' | 'arrivalEta' | 'note') => ({
    label: t(`booking.details.${key}`),
    value: guest[key],
    onChangeText: (text: string) => onChange({ [key]: text }),
    error: message(key),
    testID: `guest-${key}`,
  });

  const submit = () => {
    const parsed = guestFormSchema.safeParse(guest);
    if (!parsed.success) return setErrors(fieldErrors<Field>(parsed.error));
    setErrors({});
    onContinue(parsed.data);
  };

  return (
    <View style={styles.step}>
      <Card title={t('booking.steps.details')}>
        <TextField {...field('name')} autoComplete="name" textContentType="name" />
        <TextField
          {...field('email')}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          {...field('phone')}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <BodyText>{t('booking.details.phoneHint')}</BodyText>
        <SectionLabel>{t('booking.details.country')}</SectionLabel>
        <ChoiceGroup
          options={[
            ...COUNTRIES.map((code) => ({ value: code, label: t(`countries.${code}`) })),
            { value: OTHER, label: t('booking.details.otherCountry') },
          ]}
          selected={otherCountry ? OTHER : guest.country}
          onChange={(value) => {
            if (value === OTHER) {
              setOtherCountry(true);
              onChange({ country: '' });
            } else {
              setOtherCountry(false);
              onChange({ country: value });
            }
          }}
          testID="guest-country"
        />
        {otherCountry ? (
          <TextField
            label={t('booking.details.countryCode')}
            value={guest.country}
            onChangeText={(text) => onChange({ country: text.toUpperCase() })}
            autoCapitalize="characters"
            maxLength={2}
            testID="guest-countryCode"
          />
        ) : null}
        {message('country') ? <Notice tone="error" message={message('country')!} /> : null}
        <SectionLabel>{t('booking.details.language')}</SectionLabel>
        <ChoiceGroup
          options={LANGUAGES.map((language) => ({
            value: language,
            label: t(`account.languages.${language}`),
          }))}
          selected={guest.locale}
          onChange={(locale) => onChange({ locale })}
          testID="guest-locale"
        />
        <TextField {...field('vehiclePlate')} autoCapitalize="characters" />
        <TextField {...field('arrivalEta')} inputMode="numeric" />
        <TextField {...field('note')} multiline />
      </Card>
      <View style={styles.actions}>
        <Button label={t('booking.back')} onPress={onBack} />
        <Button
          label={t('booking.continue')}
          variant="primary"
          onPress={submit}
          testID="booking-continue"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.md },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
