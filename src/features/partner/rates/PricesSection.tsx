import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Database } from '@/api/database.types';
import { usePitchTypes } from '@/api/pitchTypes';
import { useSeasonPrices, useSetSeasonPrices } from '@/api/rates';
import { priceKey, pricesFromForm, type PriceItemType, type PriceKey } from '@/domain/rates';
import { localized, useLanguage, useT } from '@/i18n';
import { centsToInput } from '@/lib/money';
import {
  BodyText,
  Button,
  Card,
  ChoiceGroup,
  Loading,
  Notice,
  SectionLabel,
  TextField,
  spacing,
} from '@/ui';

type Tables = Database['public']['Tables'];
type Season = Tables['seasons']['Row'];
type GuestCategory = Tables['guest_categories']['Row'];
type Extra = Tables['extras']['Row'];

type Props = {
  campingId: string;
  seasons: Season[];
  guestCategories: GuestCategory[];
  extras: Extra[];
  canEdit: boolean;
};

/** The price grid of one season: pitch types, guest categories and extras. */
export function PricesSection({ campingId, seasons, guestCategories, extras, canEdit }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const season = seasons.find((s) => s.id === picked) ?? seasons[0];

  return (
    <Card title={t('partner.rates.prices.title')}>
      {season ? (
        <>
          <ChoiceGroup
            options={seasons.map((s) => ({ value: s.id, label: localized(s.name, language) }))}
            selected={season.id}
            onChange={setPicked}
            testID="prices-season"
          />
          <SeasonPrices
            key={season.id}
            campingId={campingId}
            seasonId={season.id}
            guestCategories={guestCategories}
            extras={extras}
            canEdit={canEdit}
          />
        </>
      ) : (
        <BodyText>{t('partner.rates.prices.noSeasons')}</BodyText>
      )}
    </Card>
  );
}

type Item = { key: PriceKey; label: string };

function SeasonPrices(props: Omit<Props, 'seasons'> & { seasonId: string }) {
  const { campingId, seasonId, guestCategories, extras, canEdit } = props;
  const t = useT();
  const { language } = useLanguage();
  const pitchTypes = usePitchTypes(campingId);
  const prices = useSeasonPrices(seasonId);

  if (pitchTypes.isPending || prices.isPending) return <Loading label={t('common.loading')} />;
  if (!pitchTypes.data || !prices.data) return <Notice tone="error" message={t('common.error')} />;

  const item = (
    type: PriceItemType,
    row: { id: string; name: unknown },
    suffix?: string,
  ): Item => ({
    key: priceKey(type, row.id),
    label: localized(row.name, language) + (suffix ? ` · ${suffix}` : ''),
  });
  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('partner.rates.prices.pitchTypes'),
      items: pitchTypes.data.map((p) => item('pitch', p)),
    },
    {
      title: t('partner.rates.prices.guests'),
      items: guestCategories.map((g) => item('guest', g)),
    },
    {
      title: t('partner.rates.prices.extras'),
      items: extras.map((e) => item('extra', e, t(`partner.rates.units.${e.unit}`))),
    },
  ];
  const initial = {} as Record<PriceKey, string>;
  for (const group of groups) for (const { key } of group.items) initial[key] = '';
  for (const p of prices.data) {
    const key = priceKey(p.item_type, p.item_id);
    if (key in initial) initial[key] = centsToInput(p.amount_cents, language);
  }

  return (
    <PriceForm
      // New or deleted items give a new grid.
      key={Object.keys(initial).join()}
      campingId={campingId}
      seasonId={seasonId}
      groups={groups.filter((g) => g.items.length > 0)}
      initial={initial}
      canEdit={canEdit}
    />
  );
}

type FormProps = {
  campingId: string;
  seasonId: string;
  groups: { title: string; items: Item[] }[];
  initial: Record<PriceKey, string>;
  canEdit: boolean;
};

function PriceForm({ campingId, seasonId, groups, initial, canEdit }: FormProps) {
  const t = useT();
  const save = useSetSeasonPrices(campingId);
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<PriceKey[]>([]);

  const submit = () => {
    const result = pricesFromForm(values);
    if (!result.ok) return setInvalid(result.invalid);
    setInvalid([]);
    save.mutate({ seasonId, prices: result.prices });
  };

  return (
    <View style={styles.form}>
      <BodyText>{t('partner.rates.prices.hint')}</BodyText>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <SectionLabel>{group.title}</SectionLabel>
          {group.items.map(({ key, label }) => (
            <TextField
              key={key}
              label={label}
              value={values[key]}
              onChangeText={(text) => {
                setValues((current) => ({ ...current, [key]: text }));
                save.reset();
              }}
              editable={canEdit}
              keyboardType="decimal-pad"
              inputMode="decimal"
              error={invalid.includes(key) ? t('partner.rates.errors.amount') : null}
              testID={`price-${key}`}
            />
          ))}
        </View>
      ))}
      {invalid.length ? <Notice tone="error" message={t('partner.rates.prices.invalid')} /> : null}
      {save.isError ? <Notice tone="error" message={t('common.error')} /> : null}
      {save.isSuccess ? <Notice message={t('partner.rates.prices.saved')} /> : null}
      {canEdit ? (
        <Button
          label={t('partner.rates.prices.save')}
          variant="primary"
          onPress={submit}
          loading={save.isPending}
          testID="prices-save"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  group: { gap: spacing.sm },
});
