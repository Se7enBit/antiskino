import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BUSINESS } from '@/config/business';
import { useT } from '@/i18n';
import { BodyText, Icon, Screen, colors, spacing } from '@/ui';

export const GUIDE_SECTIONS = [
  'area',
  'setup',
  'rates',
  'bookings',
  'reception',
  'team',
  'payment',
] as const;

type SectionId = (typeof GUIDE_SECTIONS)[number];

/** /partner/guide: short how-tos for the partner area, one topic open at a time. */
export function GuideScreen() {
  const t = useT();
  const [open, setOpen] = useState<SectionId | null>(null);
  return (
    <Screen>
      <BodyText>{t('partner.guide.intro')}</BodyText>
      {GUIDE_SECTIONS.map((id) => {
        const expanded = open === id;
        return (
          <View key={id} style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              aria-expanded={expanded}
              onPress={() => setOpen(expanded ? null : id)}
              style={styles.heading}
              testID={`guide-${id}`}
            >
              <Text style={styles.title}>{t(`partner.guide.sections.${id}.title`)}</Text>
              <Icon
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.muted}
              />
            </Pressable>
            {expanded ? (
              <View style={styles.body}>
                {t(`partner.guide.sections.${id}.body`, { email: BUSINESS.email })
                  .split('\n')
                  .map((line, i) => (
                    <BodyText key={i}>{line}</BodyText>
                  ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 48,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  body: { gap: spacing.xs, paddingBottom: spacing.md },
});
