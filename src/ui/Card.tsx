import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './theme';

type Props = { title?: string; children?: ReactNode };

export function Card({ title, children }: Props) {
  return (
    <View style={styles.card}>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function BodyText({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: 12, backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 22, color: colors.muted },
  label: { fontSize: 14, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
});
