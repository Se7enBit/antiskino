import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cellFor, inventoryKey, type Cell, type InventoryNight } from '@/domain/availability';
import { localized, useLanguage, useT } from '@/i18n';
import type { IsoDate } from '@/lib/dates';
import { formatNight } from '@/lib/format';
import { colors, spacing } from '@/ui';

export type GridPitchType = { id: string; name: unknown };
export type Pick = { pitchTypeId: string; night: IsoDate; allotment?: number };

type Props = {
  pitchTypes: GridPitchType[];
  nights: IsoDate[];
  inventory: Map<string, InventoryNight>;
  today: IsoDate;
  onPick: (pick: Pick) => void;
};

const ROW = 44;
const NAME = 112;
const NIGHT = 56;

/** Pitch types × nights, each cell "booked/allotment". Scrolls sideways on phones. */
export function AvailabilityGrid({ pitchTypes, nights, inventory, today, onPick }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const labels = new Map(nights.map((night) => [night, formatNight(night, language)]));

  return (
    <View style={styles.grid}>
      <View style={{ width: NAME }}>
        <View style={styles.header} />
        {pitchTypes.map((pitchType) => (
          <View key={pitchType.id} style={styles.name}>
            <Text style={styles.nameText} numberOfLines={2}>
              {localized(pitchType.name, language)}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.row}>
            {nights.map((night) => {
              const label = labels.get(night)!;
              return (
                <View key={night} style={[styles.header, styles.night]}>
                  <Text style={[styles.headerText, night === today && styles.today]}>
                    {label.weekday}
                  </Text>
                  <Text style={[styles.headerText, night === today && styles.today]}>
                    {label.day}
                  </Text>
                </View>
              );
            })}
          </View>
          {pitchTypes.map((pitchType) => {
            const pitchName = localized(pitchType.name, language);
            return (
              <View key={pitchType.id} style={styles.row}>
                {nights.map((night) => {
                  const row = inventory.get(inventoryKey(pitchType.id, night));
                  const cell = cellFor(row);
                  const label = labels.get(night)!;
                  const names = { pitchType: pitchName, night: `${label.weekday} ${label.day}` };
                  return (
                    <Pressable
                      key={night}
                      accessibilityRole="button"
                      accessibilityLabel={
                        cell.kind === 'none'
                          ? t('partner.availability.cell.none', names)
                          : t(
                              `partner.availability.cell.${cell.kind === 'closed' ? 'closed' : 'open'}`,
                              {
                                ...names,
                                booked: cell.booked,
                                allotment: cell.allotment,
                              },
                            )
                      }
                      onPress={() =>
                        onPick({ pitchTypeId: pitchType.id, night, allotment: row?.allotment })
                      }
                      style={[styles.cell, CELL_STYLES[cell.kind]]}
                      testID={`cell-${pitchType.id}-${night}`}
                    >
                      <Text style={[styles.cellText, cell.kind === 'closed' && styles.closedText]}>
                        {cellText(cell)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function cellText(cell: Cell): string {
  return cell.kind === 'none' ? '—' : `${cell.booked}/${cell.allotment}`;
}

/** The colour key under the grid. */
export function AvailabilityLegend() {
  const t = useT();
  return (
    <View style={styles.legend}>
      <Text style={styles.legendText}>{t('partner.availability.legend.cells')}</Text>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, CELL_STYLES.full]} />
          <Text style={styles.legendText}>{t('partner.availability.legend.full')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, CELL_STYLES.closed]} />
          <Text style={styles.legendText}>{t('partner.availability.legend.closed')}</Text>
        </View>
        <Text style={styles.legendText}>{t('partner.availability.legend.none')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row' },
  row: { flexDirection: 'row' },
  header: { height: ROW, justifyContent: 'center' },
  night: { width: NIGHT, alignItems: 'center' },
  headerText: { fontSize: 12, color: colors.muted },
  today: { color: colors.primary, fontWeight: '700' },
  name: { height: ROW, justifyContent: 'center', paddingRight: spacing.sm },
  nameText: { fontSize: 13, fontWeight: '600', color: colors.text },
  cell: {
    width: NIGHT - 4,
    height: ROW - 4,
    margin: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  closedText: { color: colors.danger, textDecorationLine: 'line-through' },
  legend: { gap: spacing.xs },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendText: { fontSize: 13, color: colors.muted },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
});

const CELL_STYLES = StyleSheet.create({
  none: { backgroundColor: colors.surface },
  open: { backgroundColor: colors.background },
  full: { backgroundColor: colors.warningSurface },
  closed: { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
});
