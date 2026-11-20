import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LEGAL_UPDATED } from '@/config/business';
import { useT } from '@/i18n';
import { formatDateInput } from '@/lib/dates';
import { BodyText, Screen, colors, spacing } from '@/ui';

import { PageHead } from '../common/PageHead';

export type LegalSection = { id: string; title: string; body: string };

type Props = {
  title: string;
  intro: string;
  sections: LegalSection[];
  /** The other legal page, linked at the end. */
  other: { href: '/terms' | '/privacy'; label: string };
};

/** A legal text: title, date, intro and numbered sections. Lines starting with • are list items. */
export function LegalPage({ title, intro, sections, other }: Props) {
  const t = useT();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title }} />
      <PageHead title={`${title} · Antiskino`} description={intro} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.updated}>
        {t('legal.updated', { date: formatDateInput(LEGAL_UPDATED) })}
      </Text>
      <BodyText>{intro}</BodyText>
      {sections.map((section, i) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {i + 1}. {section.title}
          </Text>
          {section.body
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, j) => (
              <BodyText key={j}>{line}</BodyText>
            ))}
        </View>
      ))}
      <Link href={other.href} style={styles.link}>
        {other.label}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  updated: { fontSize: 14, color: colors.muted },
  section: { gap: spacing.xs },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600', paddingVertical: spacing.xs },
});
