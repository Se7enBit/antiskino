import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRequestCode, useVerifyCode } from '@/api/auth';
import { authErrorKind, emailSchema, otpCodeSchema, type AuthErrorKind } from '@/domain/auth';
import { useLanguage, useT } from '@/i18n';
import { BodyText, Button, Notice, TextField, spacing } from '@/ui';

/** Two steps: email → "Send code", then the emailed code → "Sign in". */
export function SignInForm() {
  const t = useT();
  const { language } = useLanguage();
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<AuthErrorKind | null>(null);

  const sendCode = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(t('signIn.errors.invalidEmail'));
      return;
    }
    setFieldError(null);
    setError(null);
    requestCode.mutate(
      { email: parsed.data, language },
      {
        onSuccess: () => {
          setEmail(parsed.data);
          setCode('');
          setStep('code');
        },
        onError: (e) => setError(authErrorKind(e)),
      },
    );
  };

  const signIn = () => {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(t('signIn.errors.invalidCode'));
      return;
    }
    setFieldError(null);
    setError(null);
    verifyCode.mutate({ email, code: parsed.data }, { onError: (e) => setError(authErrorKind(e)) });
  };

  const backToEmail = () => {
    setStep('email');
    setFieldError(null);
    setError(null);
  };

  return (
    <View style={styles.form}>
      {step === 'email' ? (
        <>
          <BodyText>{t('signIn.intro')}</BodyText>
          <TextField
            label={t('signIn.emailLabel')}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={sendCode}
            error={fieldError}
            keyboardType="email-address"
            inputMode="email"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            returnKeyType="send"
            testID="sign-in-email"
          />
          <Button
            label={t('signIn.sendCode')}
            onPress={sendCode}
            variant="primary"
            loading={requestCode.isPending}
            testID="sign-in-send-code"
          />
        </>
      ) : (
        <>
          <BodyText>{t('signIn.codeSent', { email })}</BodyText>
          <TextField
            label={t('signIn.codeLabel')}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={signIn}
            error={fieldError}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            maxLength={12}
            autoFocus
            testID="sign-in-code"
          />
          <Button
            label={t('signIn.submit')}
            onPress={signIn}
            variant="primary"
            loading={verifyCode.isPending}
            testID="sign-in-submit"
          />
          <View style={styles.row}>
            <Button label={t('signIn.useAnotherEmail')} onPress={backToEmail} />
            <Button
              label={t('signIn.resend')}
              onPress={sendCode}
              disabled={requestCode.isPending}
              testID="sign-in-resend"
            />
          </View>
        </>
      )}
      {error ? <Notice tone="error" message={t(`signIn.errors.${error}`)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
