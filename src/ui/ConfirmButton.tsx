import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, spacing } from './theme';

type Props = {
  label: string;
  question: string;
  yes: string;
  no: string;
  onConfirm: () => void;
  loading?: boolean;
  testID?: string;
};

/** A destructive action that asks once more inline (no native dialogs, so it works on web too). */
export function ConfirmButton({ label, question, yes, no, onConfirm, loading, testID }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button label={label} onPress={() => setAsking(true)} testID={testID} />;
  return (
    <View style={styles.row}>
      <Text style={styles.question}>{question}</Text>
      <Button
        label={yes}
        onPress={onConfirm}
        loading={loading}
        testID={testID ? `${testID}-yes` : undefined}
      />
      <Button label={no} onPress={() => setAsking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Its own full-width line: inside a row of buttons it would otherwise be as
  // wide as its content and run past the card's edge instead of wrapping.
  row: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  question: { fontSize: 15, fontWeight: '600', color: colors.danger },
});
