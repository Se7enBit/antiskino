import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { colors, spacing } from './theme';

/** Scrollable page body, centred and capped in width on desktop. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
