import { StyleSheet, Text } from 'react-native';

import { colors } from '@/ui';

type Props = { html: string; text: string; title: string };

/** Phones: the email's plain-text version (the web shows the HTML; EmailFrame.web.tsx). */
export function EmailFrame({ text }: Props) {
  return (
    <Text style={styles.text} selectable>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20, color: colors.text },
});
