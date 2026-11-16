import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, spacing } from './theme';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'onSubmitEditing'
  | 'keyboardType'
  | 'inputMode'
  | 'autoComplete'
  | 'textContentType'
  | 'autoCapitalize'
  | 'autoFocus'
  | 'returnKeyType'
  | 'editable'
  | 'maxLength'
  | 'testID'
> & {
  label: string;
  error?: string | null;
};

export function TextField({ label, error, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 14, color: colors.danger },
});
