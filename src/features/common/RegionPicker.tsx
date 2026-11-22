import { StyleSheet, View } from 'react-native';

import { REGION_KEYS, REGIONS, sortRegions } from '@/domain/regions';
import { useLanguage, useT } from '@/i18n';
import { ChoiceGroup, SectionLabel, spacing } from '@/ui';

type Props = {
  label: string;
  /** A region key, or '' for none. */
  value: string;
  onChange: (region: string) => void;
  disabled?: boolean;
  testID?: string;
};

/** The camping's region, picked from the fixed list (SPEC F1), or none. */
export function RegionPicker({ label, value, onChange, disabled, testID }: Props) {
  const t = useT();
  const { language } = useLanguage();
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      <ChoiceGroup
        options={[
          { value: '', label: t('regions.none') },
          ...sortRegions(REGION_KEYS, language).map((region) => ({
            value: region,
            label: REGIONS[region][language],
          })),
        ]}
        selected={value}
        onChange={onChange}
        disabled={disabled}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
});
