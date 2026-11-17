import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Button, ConfirmButton, Notice, spacing } from '@/ui';

const ERROR_KEYS = new Set([
  'nameEl',
  'firstNight',
  'lastNight',
  'minNights',
  'minAge',
  'maxAge',
  'maxQty',
  'amount',
]);

/** Form state for a rates editor, with one error message key per field. */
export function useFormState<F extends object>(initial: F) {
  const t = useT();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof F & string, true>>>({});
  const set = <K extends keyof F>(key: K, value: F[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const errorFor = (key: keyof F & string) =>
    errors[key]
      ? t(`partner.rates.errors.${ERROR_KEYS.has(key) ? (key as 'nameEl') : 'text'}`)
      : null;
  return { values, set, errors, setErrors, errorFor };
}

type Props = {
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  deleting?: boolean;
  /** A message for a failed save or delete. */
  error?: string | null;
  testID: string;
};

/** Fields plus Save / Cancel / Delete for one rates item. */
export function EditorFrame({
  children,
  onSave,
  onCancel,
  onDelete,
  saving,
  deleting,
  error,
  testID,
}: Props) {
  const t = useT();
  return (
    <View style={styles.form}>
      {children}
      {error ? <Notice tone="error" message={error} /> : null}
      <View style={styles.actions}>
        <Button
          label={t('common.save')}
          variant="primary"
          onPress={onSave}
          loading={saving}
          testID={`${testID}-save`}
        />
        <Button label={t('common.cancel')} onPress={onCancel} />
        {onDelete ? (
          <ConfirmButton
            label={t('partner.rates.delete')}
            question={t('partner.rates.confirmDelete')}
            yes={t('partner.rates.yes')}
            no={t('partner.rates.no')}
            onConfirm={onDelete}
            loading={deleting}
            testID={`${testID}-delete`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
